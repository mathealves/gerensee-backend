import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { Prisma, Project, ProjectMember, TaskStatus } from '../../../generated/prisma/client';

const PROJECT_INCLUDE = {
  taskStatuses: {
    orderBy: { position: 'asc' as const },
  },
};

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ProjectCreateInput): Promise<Project> {
    return this.prisma.project.create({ data });
  }

  findAllInOrganization(organizationId: string, userId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: {
        organizationId,
        projectMembers: {
          some: {
            member: { userId },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllInOrganizationAsAdmin(organizationId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(projectId: string): Promise<(Project & { taskStatuses: TaskStatus[] }) | null> {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: PROJECT_INCLUDE,
    }) as Promise<(Project & { taskStatuses: TaskStatus[] }) | null>;
  }

  findOneInOrganization(projectId: string, organizationId: string): Promise<Project | null> {
    return this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: PROJECT_INCLUDE,
    });
  }

  findByNameInOrganization(name: string, organizationId: string): Promise<Project | null> {
    return this.prisma.project.findFirst({
      where: { name, organizationId },
    });
  }

  update(projectId: string, data: Prisma.ProjectUpdateInput): Promise<Project> {
    return this.prisma.project.update({ where: { id: projectId }, data });
  }

  delete(projectId: string): Promise<Project> {
    return this.prisma.project.delete({ where: { id: projectId } });
  }

  // --- Task Statuses ---

  createTaskStatus(data: Prisma.TaskStatusCreateInput): Promise<TaskStatus> {
    return this.prisma.taskStatus.create({ data });
  }

  findTaskStatuses(projectId: string): Promise<TaskStatus[]> {
    return this.prisma.taskStatus.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
    });
  }

  findTaskStatus(statusId: string): Promise<TaskStatus | null> {
    return this.prisma.taskStatus.findUnique({ where: { id: statusId } });
  }

  updateTaskStatus(statusId: string, data: Prisma.TaskStatusUpdateInput): Promise<TaskStatus> {
    return this.prisma.taskStatus.update({ where: { id: statusId }, data });
  }

  deleteTaskStatus(statusId: string): Promise<TaskStatus> {
    return this.prisma.taskStatus.delete({ where: { id: statusId } });
  }

  countTasksInStatus(statusId: string): Promise<number> {
    return this.prisma.task.count({ where: { statusId } });
  }

  // --- Project Members ---

  findProjectMember(projectId: string, memberId: string): Promise<ProjectMember | null> {
    return this.prisma.projectMember.findFirst({
      where: { projectId, memberId },
    });
  }

  findProjectMemberById(projectMemberId: string): Promise<ProjectMember | null> {
    return this.prisma.projectMember.findUnique({ where: { id: projectMemberId } });
  }

  findProjectMembers(projectId: string) {
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        member: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { addedAt: 'asc' },
    });
  }

  addMember(data: Prisma.ProjectMemberCreateInput): Promise<ProjectMember> {
    return this.prisma.projectMember.create({ data });
  }

  removeMember(projectMemberId: string): Promise<ProjectMember> {
    return this.prisma.projectMember.delete({ where: { id: projectMemberId } });
  }
}
