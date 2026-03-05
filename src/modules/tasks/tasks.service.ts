import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TasksRepository, TaskFilters } from './repositories/tasks.repository';
import type { CreateTaskDto, UpdateTaskDto, AssignTaskDto } from './dto';
import type { CurrentUserType } from '../../core/auth/decorators/current-user.decorator';
import { BoardGateway } from './board.gateway';
import { Task, TaskPriority } from '../../generated/prisma/client';

export interface TaskQueryFilters {
  statusId?: string;
  priority?: TaskPriority;
  assignedToMe?: boolean;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly repository: TasksRepository,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => BoardGateway))
    private readonly boardGateway: BoardGateway,
  ) {}

  async create(
    user: CurrentUserType,
    projectId: string,
    dto: CreateTaskDto,
  ): Promise<Task> {
    await this.requireProjectAccess(user, projectId);

    // Validate statusId belongs to this project
    const status = await this.prisma.taskStatus.findFirst({
      where: { id: dto.statusId, projectId },
    });
    if (!status) {
      throw new BadRequestException('Status does not belong to this project');
    }

    // Resolve assigneeIds (user IDs) → projectMember IDs
    const projectMemberIds: string[] = [];
    if (dto.assigneeIds?.length) {
      projectMemberIds.push(
        ...(await this.resolveAssigneeIds(
          dto.assigneeIds,
          projectId,
          user.organizationId,
        )),
      );
    }

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          statusId: dto.statusId,
          projectId,
          organizationId: user.organizationId,
          createdById: user.id,
        },
        include: {
          status: true,
          assignments: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      if (projectMemberIds.length > 0) {
        await tx.taskAssignments.createMany({
          data: projectMemberIds.map((projectMemberId) => ({
            taskId: created.id,
            projectMemberId,
            assignedById: user.id,
          })),
        });
      }

      return created;
    });

    this.boardGateway.notifyTaskCreated(projectId, task);
    return task;
  }

  async findAll(
    user: CurrentUserType,
    projectId: string,
    filters: TaskQueryFilters,
  ): Promise<Task[]> {
    await this.requireProjectAccess(user, projectId);

    const repoFilters: TaskFilters = {
      statusId: filters.statusId,
      priority: filters.priority,
    };

    if (filters.assignedToMe) {
      const pm = await this.getProjectMember(user, projectId);
      repoFilters.assignedToMemberId = pm.id;
    }

    return this.repository.findAllInProject(projectId, repoFilters);
  }

  async getBoard(user: CurrentUserType, projectId: string) {
    await this.requireProjectAccess(user, projectId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    const columns = await this.repository.findBoardData(projectId);

    return { project, columns };
  }

  async findOne(user: CurrentUserType, taskId: string): Promise<Task> {
    const task = await this.repository.findOneInOrg(
      taskId,
      user.organizationId,
    );
    if (!task) throw new NotFoundException('Task not found');

    await this.requireProjectAccess(user, task.projectId);
    return task;
  }

  async update(
    user: CurrentUserType,
    taskId: string,
    dto: UpdateTaskDto,
  ): Promise<Task> {
    const task = await this.repository.findOneInOrg(
      taskId,
      user.organizationId,
    );
    if (!task) throw new NotFoundException('Task not found');

    await this.requireProjectAccess(user, task.projectId);

    // If moving to a new status, validate it belongs to the same project
    if (dto.statusId && dto.statusId !== task.statusId) {
      const status = await this.prisma.taskStatus.findFirst({
        where: { id: dto.statusId, projectId: task.projectId },
      });
      if (!status) {
        throw new BadRequestException('Status does not belong to this project');
      }
    }

    const updated = await this.repository.update(taskId, {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      dueDate:
        dto.dueDate !== undefined
          ? dto.dueDate
            ? new Date(dto.dueDate)
            : null
          : undefined,
      statusId: dto.statusId,
    });

    this.boardGateway.notifyTaskUpdated(task.projectId, updated, user);
    return updated;
  }

  async delete(user: CurrentUserType, taskId: string): Promise<void> {
    const task = await this.repository.findOneInOrg(
      taskId,
      user.organizationId,
    );
    if (!task) throw new NotFoundException('Task not found');

    await this.requireProjectAccess(user, task.projectId);
    await this.repository.delete(taskId);

    this.boardGateway.notifyTaskDeleted(task.projectId, taskId);
  }

  async assignUser(user: CurrentUserType, taskId: string, dto: AssignTaskDto) {
    const task = await this.repository.findOneInOrg(
      taskId,
      user.organizationId,
    );
    if (!task) throw new NotFoundException('Task not found');

    await this.requireProjectAccess(user, task.projectId);

    // Resolve userId → projectMember
    const [projectMemberId] = await this.resolveAssigneeIds(
      [dto.userId],
      task.projectId,
      user.organizationId,
    );

    const existing = await this.repository.findAssignment(
      taskId,
      projectMemberId,
    );
    if (existing)
      throw new ConflictException('User is already assigned to this task');

    const assignment = await this.repository.createAssignment({
      task: { connect: { id: taskId } },
      projectMember: { connect: { id: projectMemberId } },
      assignedBy: { connect: { id: user.id } },
    });

    return assignment;
  }

  async unassignUser(
    user: CurrentUserType,
    taskId: string,
    assignmentId: string,
  ): Promise<void> {
    const task = await this.repository.findOneInOrg(
      taskId,
      user.organizationId,
    );
    if (!task) throw new NotFoundException('Task not found');

    await this.requireProjectAccess(user, task.projectId);

    const assignment = await this.repository.findAssignmentById(assignmentId);
    if (!assignment || assignment.taskId !== taskId) {
      throw new NotFoundException('Assignment not found');
    }

    await this.repository.deleteAssignment(assignmentId);
  }

  // --- Helpers ---

  private async requireProjectAccess(
    user: CurrentUserType,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: user.organizationId },
    });
    if (!project) throw new NotFoundException('Project not found');

    if (user.role === 'MEMBER') {
      const pm = await this.prisma.member.findFirst({
        where: { userId: user.id, organizationId: user.organizationId },
      });
      if (!pm)
        throw new ForbiddenException('Organization membership not found');

      const projectMember = await this.prisma.projectMember.findFirst({
        where: { projectId, memberId: pm.id },
      });
      if (!projectMember) {
        throw new ForbiddenException(
          'Access denied: not a member of this project',
        );
      }
    }
  }

  async getProjectMember(user: CurrentUserType, projectId: string) {
    const member = await this.prisma.member.findFirst({
      where: { userId: user.id, organizationId: user.organizationId },
    });
    if (!member)
      throw new ForbiddenException('Organization membership not found');

    const pm = await this.prisma.projectMember.findFirst({
      where: { projectId, memberId: member.id },
    });
    if (!pm) throw new ForbiddenException('Not a project member');
    return pm;
  }

  private async resolveAssigneeIds(
    userIds: string[],
    projectId: string,
    organizationId: string,
  ): Promise<string[]> {
    const projectMemberIds: string[] = [];

    for (const userId of userIds) {
      const member = await this.prisma.member.findFirst({
        where: { userId, organizationId },
      });
      if (!member) {
        throw new BadRequestException(
          `User ${userId} is not in this organization`,
        );
      }

      const pm = await this.prisma.projectMember.findFirst({
        where: { projectId, memberId: member.id },
      });
      if (!pm) {
        throw new BadRequestException(
          `User ${userId} is not a member of this project`,
        );
      }

      projectMemberIds.push(pm.id);
    }

    return projectMemberIds;
  }
}
