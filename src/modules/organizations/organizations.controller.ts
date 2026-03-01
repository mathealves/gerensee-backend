import { 
  Controller, 
  Get, 
  Post, 
  Patch,
  Delete,
  Param, 
  Body, 
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { 
  CreateOrganizationDto, 
  UpdateOrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
} from './dto';
import { OrganizationsService } from './organizations.service';
import { Organization, Member } from '../../generated/prisma/client';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserType } from '../../core/auth/decorators/current-user.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: CurrentUserType,
    @Body() createOrganizationDto: CreateOrganizationDto,
  ): Promise<Organization> {
    return this.organizationsService.create(user, createOrganizationDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: CurrentUserType,
  ): Promise<Array<Organization & { role: string }>> {
    return this.organizationsService.findAll(user);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<Organization> {
    return this.organizationsService.findOne(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
  ): Promise<Organization> {
    return this.organizationsService.update(user, id, updateOrganizationDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<void> {
    await this.organizationsService.delete(user, id);
  }

  // Member management endpoints

  @Get(':id/members')
  getMembers(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
  ): Promise<Member[]> {
    return this.organizationsService.getMembers(user, id);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  inviteMember(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Body() inviteMemberDto: InviteMemberDto,
  ): Promise<Member> {
    return this.organizationsService.inviteMember(user, id, inviteMemberDto);
  }

  @Patch(':id/members/:memberId')
  updateMemberRole(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
  ): Promise<Member> {
    return this.organizationsService.updateMemberRole(user, id, memberId, updateMemberRoleDto);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() user: CurrentUserType,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ): Promise<void> {
    await this.organizationsService.removeMember(user, id, memberId);
  }
}

