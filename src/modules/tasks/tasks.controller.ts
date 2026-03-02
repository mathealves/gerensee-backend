import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, AssignTaskDto } from './dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import type { CurrentUserType } from '../../core/auth/decorators/current-user.decorator';
import { TaskPriority } from '../../generated/prisma/client';

@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // --- Tasks ---

  @Post('projects/:projectId/tasks')
  create(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(user, projectId, dto);
  }

  @Get('projects/:projectId/tasks')
  findAll(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
    @Query('statusId') statusId?: string,
    @Query('priority') priority?: TaskPriority,
    @Query('assignedToMe') assignedToMe?: string,
  ) {
    return this.tasksService.findAll(user, projectId, {
      statusId,
      priority,
      assignedToMe: assignedToMe === 'true',
    });
  }

  @Get('projects/:projectId/board')
  getBoard(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
  ) {
    return this.tasksService.getBoard(user, projectId);
  }

  @Get('tasks/:taskId')
  findOne(
    @CurrentUser() user: CurrentUserType,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.findOne(user, taskId);
  }

  @Patch('tasks/:taskId')
  update(
    @CurrentUser() user: CurrentUserType,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(user, taskId, dto);
  }

  @Delete('tasks/:taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: CurrentUserType,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.delete(user, taskId);
  }

  // --- Assignments ---

  @Post('tasks/:taskId/assign')
  assignUser(
    @CurrentUser() user: CurrentUserType,
    @Param('taskId') taskId: string,
    @Body() dto: AssignTaskDto,
  ) {
    return this.tasksService.assignUser(user, taskId, dto);
  }

  @Delete('tasks/:taskId/assignments/:assignmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unassignUser(
    @CurrentUser() user: CurrentUserType,
    @Param('taskId') taskId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    return this.tasksService.unassignUser(user, taskId, assignmentId);
  }
}
