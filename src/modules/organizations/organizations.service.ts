import { 
  Injectable, 
  NotFoundException, 
  ForbiddenException, 
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { CreateOrganizationDto, UpdateOrganizationDto, InviteMemberDto, UpdateMemberRoleDto } from './dto';
import { OrganizationsRepository } from './repositories/organizations.repository';
import { Organization, Member, Role } from '../../generated/prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import type { CurrentUserType } from '../../core/auth/decorators/current-user.decorator';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly repository: OrganizationsRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create a new organization with the current user as OWNER
   */
  async create(user: CurrentUserType, data: CreateOrganizationDto): Promise<Organization> {
    // Check if user already owns an organization
    const ownershipCount = await this.repository.countUserOwnerships(user.id);
    if (ownershipCount > 0) {
      throw new ConflictException('User can only own one organization');
    }

    // Check if organization name is already taken
    const existing = await this.prisma.organization.findUnique({
      where: { name: data.name },
    });
    
    if (existing) {
      throw new ConflictException('Organization name already taken');
    }

    return this.repository.create(data);
  }

  /**
   * Get all organizations where the user is a member
   */
  async findAll(user: CurrentUserType): Promise<Array<Organization & { role: string }>> {
    return this.repository.findAll(user.id);
  }

  /**
   * Get a specific organization (requires membership)
   */
  async findOne(user: CurrentUserType, organizationId: string): Promise<Organization> {
    const organization = await this.repository.findOne(organizationId, user.id);
    
    if (!organization) {
      throw new NotFoundException('Organization not found or access denied');
    }

    return organization;
  }

  /**
   * Update organization (requires OWNER or ADMIN role)
   */
  async update(
    user: CurrentUserType,
    organizationId: string,
    data: UpdateOrganizationDto,
  ): Promise<Organization> {
    // Verify membership and role
    await this.requireRole(user.id, organizationId, ['OWNER', 'ADMIN']);

    // If updating name, check it's not taken
    if (data.name) {
      const existing = await this.prisma.organization.findFirst({
        where: {
          name: data.name,
          id: { not: organizationId },
        },
      });
      
      if (existing) {
        throw new ConflictException('Organization name already taken');
      }
    }

    return this.repository.update(organizationId, data);
  }

  /**
   * Delete organization (requires OWNER role)
   */
  async delete(user: CurrentUserType, organizationId: string): Promise<void> {
    // Verify user is OWNER
    await this.requireRole(user.id, organizationId, ['OWNER']);

    // Check if organization has projects
    const projectCount = await this.prisma.project.count({
      where: { organizationId },
    });

    if (projectCount > 0) {
      throw new BadRequestException(
        'Cannot delete organization with active projects. Delete all projects first.',
      );
    }

    await this.repository.delete(organizationId);
  }

  /**
   * Get all members of an organization
   */
  async getMembers(user: CurrentUserType, organizationId: string): Promise<Member[]> {
    // Verify membership
    await this.requireMembership(user.id, organizationId);

    return this.repository.findMembers(organizationId);
  }

  /**
   * Invite a new member to the organization (requires OWNER or ADMIN)
   */
  async inviteMember(
    user: CurrentUserType,
    organizationId: string,
    data: InviteMemberDto,
  ): Promise<Member> {
    // Verify user has permission
    await this.requireRole(user.id, organizationId, ['OWNER', 'ADMIN']);

    // Find user by email
    const invitedUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!invitedUser) {
      throw new NotFoundException('User not found with provided email');
    }

    // Check if user is already a member
    const existingMember = await this.repository.findMemberByUserAndOrg(
      invitedUser.id,
      organizationId,
    );

    if (existingMember) {
      throw new ConflictException('User is already a member of this organization');
    }

    // If inviting as OWNER, enforce the "one OWNER per org" constraint
    if (data.role === 'OWNER') {
      const ownerCount = await this.repository.countOwners(organizationId);
      if (ownerCount > 0) {
        throw new BadRequestException(
          'Organization already has an OWNER. Use ownership transfer instead.',
        );
      }

      // Check if user already owns another organization
      const userOwnershipCount = await this.repository.countUserOwnerships(invitedUser.id);
      if (userOwnershipCount > 0) {
        throw new BadRequestException('User already owns another organization');
      }
    }

    return this.repository.createMember({
      user: { connect: { id: invitedUser.id } },
      organization: { connect: { id: organizationId } },
      role: data.role,
    });
  }

  /**
   * Update member role (requires OWNER or ADMIN)
   * Handles ownership transfer
   */
  async updateMemberRole(
    user: CurrentUserType,
    organizationId: string,
    memberId: string,
    data: UpdateMemberRoleDto,
  ): Promise<Member> {
    // Verify user has permission
    const currentUserMember = await this.requireRole(user.id, organizationId, ['OWNER', 'ADMIN']);

    // Get the member being updated
    const targetMember = await this.repository.findMemberById(memberId);
    
    if (!targetMember || targetMember.organizationId !== organizationId) {
      throw new NotFoundException('Member not found');
    }

    // Prevent self-demotion if you're the OWNER
    if (targetMember.userId === user.id && targetMember.role === 'OWNER') {
      throw new BadRequestException('Cannot change your own OWNER role. Transfer ownership first.');
    }

    // Ownership transfer logic
    if (data.role === 'OWNER') {
      // Only current OWNER can transfer ownership
      if (currentUserMember.role !== 'OWNER') {
        throw new ForbiddenException('Only the current OWNER can transfer ownership');
      }

      // Check if target user already owns another organization
      const userOwnershipCount = await this.repository.countUserOwnerships(targetMember.userId);
      if (userOwnershipCount > 0) {
        throw new BadRequestException('User already owns another organization');
      }

      // Transfer ownership: demote current owner and promote target member
      await this.prisma.$transaction([
        // Demote current owner to ADMIN
        this.prisma.member.update({
          where: { id: currentUserMember.id },
          data: { role: 'ADMIN' },
        }),
        // Promote target member to OWNER
        this.prisma.member.update({
          where: { id: memberId },
          data: { role: data.role },
        }),
      ]);

      return this.repository.findMemberById(memberId) as Promise<Member>;
    }

    // Regular role change (not to OWNER)
    if (targetMember.role === 'OWNER') {
      throw new BadRequestException('Cannot demote OWNER. Transfer ownership first.');
    }

    return this.repository.updateMember(memberId, { role: data.role });
  }

  /**
   * Remove a member from the organization (requires OWNER or ADMIN)
   */
  async removeMember(
    user: CurrentUserType,
    organizationId: string,
    memberId: string,
  ): Promise<void> {
    // Verify user has permission
    await this.requireRole(user.id, organizationId, ['OWNER', 'ADMIN']);

    // Get the member being removed
    const targetMember = await this.repository.findMemberById(memberId);
    
    if (!targetMember || targetMember.organizationId !== organizationId) {
      throw new NotFoundException('Member not found');
    }

    // Cannot remove OWNER
    if (targetMember.role === 'OWNER') {
      throw new BadRequestException('Cannot remove OWNER. Transfer ownership first.');
    }

    // Cannot remove yourself if you're the OWNER
    if (targetMember.userId === user.id) {
      throw new BadRequestException('Cannot remove yourself from the organization');
    }

    await this.repository.deleteMember(memberId);
  }

  /**
   * Helper: Verify user is a member of the organization
   */
  private async requireMembership(userId: string, organizationId: string): Promise<Member> {
    const member = await this.repository.findMemberByUserAndOrg(userId, organizationId);
    
    if (!member) {
      throw new ForbiddenException('Access denied: not a member of this organization');
    }

    return member;
  }

  /**
   * Helper: Verify user has one of the required roles
   */
  private async requireRole(
    userId: string,
    organizationId: string,
    roles: Role[],
  ): Promise<Member> {
    const member = await this.requireMembership(userId, organizationId);

    if (!roles.includes(member.role)) {
      throw new ForbiddenException(`Access denied: requires one of: ${roles.join(', ')}`);
    }

    return member;
  }
}

