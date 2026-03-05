import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { ProjectsRepository } from './repositories/projects.repository';
import type {
  CreateProjectDto,
  UpdateProjectDto,
  AddProjectMemberDto,
  CreateTaskStatusDto,
  UpdateTaskStatusDto,
} from './dto';
import type { CurrentUserType } from '../../core/auth/decorators/current-user.decorator';
import { Project, TaskStatus, Role } from '../../generated/prisma/client';

const DEFAULT_STATUSES = [
  { name: 'To Do', position: 0, color: '#9E9E9E' },
  { name: 'In Progress', position: 1, color: '#2196F3' },
  { name: 'Done', position: 2, color: '#4CAF50' },
];

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    user: CurrentUserType,
    dto: CreateProjectDto,
  ): Promise<Project & { taskStatuses: TaskStatus[] }> {
    this.requireRole(user, ['OWNER', 'ADMIN']);

    // Check for duplicate project name in organization
    const existing = await this.repository.findByNameInOrganization(
      dto.name,
      user.organizationId,
    );
    if (existing) {
      throw new ConflictException(
        'Project name already exists in this organization',
      );
    }

    // Create project + default task statuses + add creator as project member in transaction
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          organizationId: user.organizationId,
          createdById: user.id,
        },
      });

      // Create default task statuses
      await tx.taskStatus.createMany({
        data: DEFAULT_STATUSES.map((s) => ({ ...s, projectId: project.id })),
      });

      // Find the creator's Member record and add them to the project
      const creatorMember = await tx.member.findFirst({
        where: { userId: user.id, organizationId: user.organizationId },
      });
      if (creatorMember) {
        await tx.projectMember.create({
          data: { projectId: project.id, memberId: creatorMember.id },
        });
      }

      const statuses = await tx.taskStatus.findMany({
        where: { projectId: project.id },
        orderBy: { position: 'asc' },
      });

      return { ...project, taskStatuses: statuses };
    });
  }

  async findAll(user: CurrentUserType): Promise<Project[]> {
    // OWNER and ADMIN see all org projects; MEMBER sees only assigned ones
    if (this.isAdminOrOwner(user.role)) {
      return this.repository.findAllInOrganizationAsAdmin(user.organizationId);
    }
    return this.repository.findAllInOrganization(user.organizationId, user.id);
  }

  async findOne(
    user: CurrentUserType,
    projectId: string,
  ): Promise<Project & { taskStatuses: TaskStatus[] }> {
    const project = await this.repository.findOne(projectId);

    if (!project || project.organizationId !== user.organizationId) {
      throw new NotFoundException('Project not found');
    }

    // MEMBER must be assigned to the project
    if (!this.isAdminOrOwner(user.role)) {
      const membership = await this.repository.findProjectMember(
        projectId,
        await this.getMemberId(user),
      );
      if (!membership) {
        throw new ForbiddenException(
          'Access denied: not a member of this project',
        );
      }
    }

    return project;
  }

  async update(
    user: CurrentUserType,
    projectId: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    this.requireRole(user, ['OWNER', 'ADMIN']);
    await this.requireProjectInOrg(projectId, user.organizationId);

    if (dto.name) {
      const existing = await this.repository.findByNameInOrganization(
        dto.name,
        user.organizationId,
      );
      if (existing && existing.id !== projectId) {
        throw new ConflictException(
          'Project name already exists in this organization',
        );
      }
    }

    return this.repository.update(projectId, dto);
  }

  async delete(user: CurrentUserType, projectId: string): Promise<void> {
    this.requireRole(user, ['OWNER', 'ADMIN']);
    await this.requireProjectInOrg(projectId, user.organizationId);
    await this.repository.delete(projectId);
  }

  // --- Task Statuses ---

  async findStatuses(
    user: CurrentUserType,
    projectId: string,
  ): Promise<TaskStatus[]> {
    await this.requireProjectAccess(user, projectId);
    return this.repository.findTaskStatuses(projectId);
  }

  async createStatus(
    user: CurrentUserType,
    projectId: string,
    dto: CreateTaskStatusDto,
  ): Promise<TaskStatus> {
    this.requireRole(user, ['OWNER', 'ADMIN']);
    await this.requireProjectInOrg(projectId, user.organizationId);

    let position = dto.position;
    if (position === undefined) {
      const existing = await this.repository.findTaskStatuses(projectId);
      position =
        existing.length > 0
          ? Math.max(...existing.map((s) => s.position)) + 1
          : 0;
    }

    return this.repository.createTaskStatus({
      name: dto.name,
      color: dto.color,
      position,
      project: { connect: { id: projectId } },
    });
  }

  async updateStatus(
    user: CurrentUserType,
    projectId: string,
    statusId: string,
    dto: UpdateTaskStatusDto,
  ): Promise<TaskStatus> {
    this.requireRole(user, ['OWNER', 'ADMIN']);
    await this.requireProjectInOrg(projectId, user.organizationId);
    await this.requireStatusInProject(statusId, projectId);

    return this.repository.updateTaskStatus(statusId, dto);
  }

  async deleteStatus(
    user: CurrentUserType,
    projectId: string,
    statusId: string,
  ): Promise<void> {
    this.requireRole(user, ['OWNER', 'ADMIN']);
    await this.requireProjectInOrg(projectId, user.organizationId);
    await this.requireStatusInProject(statusId, projectId);

    const taskCount = await this.repository.countTasksInStatus(statusId);
    if (taskCount > 0) {
      throw new BadRequestException('Cannot delete status with existing tasks');
    }

    await this.repository.deleteTaskStatus(statusId);
  }

  // --- Project Members ---

  async findMembers(user: CurrentUserType, projectId: string) {
    await this.requireProjectAccess(user, projectId);
    return this.repository.findProjectMembers(projectId);
  }

  async addMember(
    user: CurrentUserType,
    projectId: string,
    dto: AddProjectMemberDto,
  ) {
    this.requireRole(user, ['OWNER', 'ADMIN']);
    await this.requireProjectInOrg(projectId, user.organizationId);

    // Resolve userId → Member (must be in same org)
    const member = await this.prisma.member.findFirst({
      where: { userId: dto.userId, organizationId: user.organizationId },
    });
    if (!member) {
      throw new BadRequestException(
        'User is not a member of this organization',
      );
    }

    // Check if already in project
    const existing = await this.repository.findProjectMember(
      projectId,
      member.id,
    );
    if (existing) {
      throw new ConflictException('User is already a member of this project');
    }

    return this.repository.addMember({
      project: { connect: { id: projectId } },
      member: { connect: { id: member.id } },
    });
  }

  async removeMember(
    user: CurrentUserType,
    projectId: string,
    projectMemberId: string,
  ): Promise<void> {
    this.requireRole(user, ['OWNER', 'ADMIN']);
    await this.requireProjectInOrg(projectId, user.organizationId);

    const pm = await this.repository.findProjectMemberById(projectMemberId);
    if (!pm || pm.projectId !== projectId) {
      throw new NotFoundException('Project member not found');
    }

    await this.repository.removeMember(projectMemberId);
  }

  // --- Helpers ---

  private isAdminOrOwner(role: string): boolean {
    return role === 'OWNER' || role === 'ADMIN';
  }

  private requireRole(user: CurrentUserType, roles: Role[]): void {
    if (!roles.includes(user.role as Role)) {
      throw new ForbiddenException(
        `Access denied: requires one of: ${roles.join(', ')}`,
      );
    }
  }

  private async requireProjectInOrg(
    projectId: string,
    organizationId: string,
  ): Promise<Project> {
    const project = await this.repository.findOneInOrganization(
      projectId,
      organizationId,
    );
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  private async requireProjectAccess(
    user: CurrentUserType,
    projectId: string,
  ): Promise<void> {
    const project = await this.repository.findOneInOrganization(
      projectId,
      user.organizationId,
    );
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!this.isAdminOrOwner(user.role)) {
      const memberId = await this.getMemberId(user);
      const pm = await this.repository.findProjectMember(projectId, memberId);
      if (!pm) {
        throw new ForbiddenException(
          'Access denied: not a member of this project',
        );
      }
    }
  }

  private async requireStatusInProject(
    statusId: string,
    projectId: string,
  ): Promise<TaskStatus> {
    const status = await this.repository.findTaskStatus(statusId);
    if (!status || status.projectId !== projectId) {
      throw new NotFoundException('Task status not found');
    }
    return status;
  }

  private async getMemberId(user: CurrentUserType): Promise<string> {
    const member = await this.prisma.member.findFirst({
      where: { userId: user.id, organizationId: user.organizationId },
    });
    if (!member) {
      throw new ForbiddenException('Organization membership not found');
    }
    return member.id;
  }
}
