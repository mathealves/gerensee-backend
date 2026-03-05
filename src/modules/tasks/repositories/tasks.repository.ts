import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Task,
  TaskAssignments,
  TaskPriority,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

export interface TaskFilters {
  statusId?: string;
  priority?: TaskPriority;
  assignedToMemberId?: string;
}

const TASK_INCLUDE = {
  status: true,
  assignments: {
    include: {
      projectMember: {
        include: {
          member: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  },
  createdBy: { select: { id: true, name: true, email: true } },
};

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.TaskCreateInput): Promise<Task> {
    return this.prisma.task.create({ data, include: TASK_INCLUDE });
  }

  findAllInProject(projectId: string, filters: TaskFilters): Promise<Task[]> {
    const where: Prisma.TaskWhereInput = { projectId };

    if (filters.statusId) where.statusId = filters.statusId;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedToMemberId) {
      where.assignments = {
        some: { projectMemberId: filters.assignedToMemberId },
      };
    }

    return this.prisma.task.findMany({
      where,
      include: TASK_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  findBoardData(projectId: string) {
    return this.prisma.taskStatus.findMany({
      where: { projectId },
      orderBy: { position: 'asc' },
      include: {
        tasks: {
          include: TASK_INCLUDE,
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  findOne(taskId: string): Promise<Task | null> {
    return this.prisma.task.findUnique({
      where: { id: taskId },
      include: TASK_INCLUDE,
    });
  }

  findOneInOrg(taskId: string, organizationId: string): Promise<Task | null> {
    return this.prisma.task.findFirst({
      where: { id: taskId, organizationId },
      include: TASK_INCLUDE,
    });
  }

  update(taskId: string, data: Prisma.TaskUncheckedUpdateInput): Promise<Task> {
    return this.prisma.task.update({
      where: { id: taskId },
      data,
      include: TASK_INCLUDE,
    });
  }

  delete(taskId: string): Promise<Task> {
    return this.prisma.task.delete({ where: { id: taskId } });
  }

  // --- Assignments ---

  findAssignment(
    taskId: string,
    projectMemberId: string,
  ): Promise<TaskAssignments | null> {
    return this.prisma.taskAssignments.findFirst({
      where: { taskId, projectMemberId },
    });
  }

  findAssignmentById(assignmentId: string): Promise<TaskAssignments | null> {
    return this.prisma.taskAssignments.findUnique({
      where: { id: assignmentId },
    });
  }

  createAssignment(
    data: Prisma.TaskAssignmentsCreateInput,
  ): Promise<TaskAssignments> {
    return this.prisma.taskAssignments.create({ data });
  }

  deleteAssignment(assignmentId: string): Promise<TaskAssignments> {
    return this.prisma.taskAssignments.delete({ where: { id: assignmentId } });
  }
}
