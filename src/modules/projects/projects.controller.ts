import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  AddProjectMemberDto,
  CreateTaskStatusDto,
  UpdateTaskStatusDto,
} from './dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import type { CurrentUserType } from '../../core/auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // --- Projects ---

  @Post('organizations/:organizationId/projects')
  create(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(user, dto);
  }

  @Get('organizations/:organizationId/projects')
  findAll(@CurrentUser() user: CurrentUserType) {
    return this.projectsService.findAll(user);
  }

  @Get('projects/:projectId')
  findOne(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.findOne(user, projectId);
  }

  @Patch('projects/:projectId')
  update(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(user, projectId, dto);
  }

  @Delete('projects/:projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.delete(user, projectId);
  }

  // --- Task Statuses ---

  @Get('projects/:projectId/statuses')
  findStatuses(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.findStatuses(user, projectId);
  }

  @Post('projects/:projectId/statuses')
  createStatus(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskStatusDto,
  ) {
    return this.projectsService.createStatus(user, projectId, dto);
  }

  @Patch('projects/:projectId/statuses/:statusId')
  updateStatus(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
    @Param('statusId') statusId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.projectsService.updateStatus(user, projectId, statusId, dto);
  }

  @Delete('projects/:projectId/statuses/:statusId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteStatus(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
    @Param('statusId') statusId: string,
  ) {
    return this.projectsService.deleteStatus(user, projectId, statusId);
  }

  // --- Project Members ---

  @Get('projects/:projectId/members')
  findMembers(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
  ) {
    return this.projectsService.findMembers(user, projectId);
  }

  @Post('projects/:projectId/members')
  addMember(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(user, projectId, dto);
  }

  @Delete('projects/:projectId/members/:projectMemberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
    @Param('projectMemberId') projectMemberId: string,
  ) {
    return this.projectsService.removeMember(user, projectId, projectMemberId);
  }
}
