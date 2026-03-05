import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface SocketData {
  user?: CurrentUserType;
}
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../core/database/prisma.service';
import type { JwtPayload } from '../../core/auth/strategies/jwt.strategy';
import { Task } from '../../generated/prisma/client';
import type { CurrentUserType } from '../../core/auth/decorators/current-user.decorator';

@WebSocketGateway({ cors: { origin: '*' } })
export class BoardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(BoardGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // --- Connection Lifecycle ---

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        this.disconnect(client, 'AUTH_FAILED', 'No token provided');
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user) {
        this.disconnect(client, 'AUTH_FAILED', 'User not found');
        return;
      }

      // Attach user to socket for later use
      (client.data as SocketData).user = {
        id: payload.sub,
        email: payload.email,
        organizationId: payload.organizationId,
        role: payload.role,
      } satisfies CurrentUserType;

      this.logger.log(`Client connected: ${client.id} (user: ${user.email})`);
    } catch {
      this.disconnect(client, 'AUTH_FAILED', 'Invalid or expired token');
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // --- Client → Server Messages ---

  @SubscribeMessage('joinBoard')
  async handleJoinBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ): Promise<void> {
    const user = (client.data as SocketData).user;
    if (!user) {
      client.emit('error', {
        message: 'Not authenticated',
        code: 'AUTH_FAILED',
      });
      return;
    }

    const { projectId } = data;

    // Validate project belongs to user's organization
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: user.organizationId },
    });
    if (!project) {
      client.emit('error', { message: 'Project not found', code: 'FORBIDDEN' });
      return;
    }

    // MEMBER must be a project member
    if (user.role === 'MEMBER') {
      const member = await this.prisma.member.findFirst({
        where: { userId: user.id, organizationId: user.organizationId },
      });
      const pm = member
        ? await this.prisma.projectMember.findFirst({
            where: { projectId, memberId: member.id },
          })
        : null;

      if (!pm) {
        client.emit('error', {
          message: 'Not a member of this project',
          code: 'FORBIDDEN',
        });
        return;
      }
    }

    const room = `board:${projectId}`;
    await client.join(room);
    client.emit('boardJoined', {
      projectId,
      message: 'Joined board successfully',
    });
    this.logger.log(`User ${user.id} joined room ${room}`);
  }

  @SubscribeMessage('leaveBoard')
  async handleLeaveBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ): Promise<void> {
    const room = `board:${data.projectId}`;
    await client.leave(room);
    client.emit('boardLeft', { projectId: data.projectId });
  }

  // --- Server → Client Notifications ---

  notifyTaskCreated(projectId: string, task: Task): void {
    this.server
      .to(`board:${projectId}`)
      .emit('taskCreated', { projectId, task });
  }

  notifyTaskUpdated(
    projectId: string,
    task: Task,
    updatedBy: CurrentUserType,
  ): void {
    this.server.to(`board:${projectId}`).emit('taskUpdated', {
      projectId,
      task: {
        ...task,
        updatedBy: { id: updatedBy.id },
      },
    });
  }

  notifyTaskDeleted(projectId: string, taskId: string): void {
    this.server
      .to(`board:${projectId}`)
      .emit('taskDeleted', { projectId, taskId });
  }

  // --- Helpers ---

  private extractToken(client: Socket): string | null {
    const auth = client.handshake.auth?.token as string | undefined;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);
    return auth ?? null;
  }

  private disconnect(client: Socket, code: string, message: string): void {
    client.emit('error', { message, code });
    client.disconnect(true);
  }
}
