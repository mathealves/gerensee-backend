import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { Prisma, Organization, Member } from '../../../generated/prisma/client';

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return this.prisma.organization.create({ data });
  }

  findAll(userId: string): Promise<Array<Organization & { role: string }>> {
    return this.prisma.organization
      .findMany({
        where: {
          members: {
            some: {
              userId: userId,
            },
          },
        },
        include: {
          members: {
            where: {
              userId: userId,
            },
            select: {
              role: true,
            },
          },
        },
      })
      .then(
        (orgs) =>
          orgs.map((org) => ({
            ...org,
            role: org.members[0]?.role || 'MEMBER',
            members: undefined,
          })) as Array<Organization & { role: string }>,
      );
  }

  findOne(id: string, userId: string): Promise<Organization | null> {
    return this.prisma.organization.findFirst({
      where: {
        id,
        members: {
          some: {
            userId: userId,
          },
        },
      },
    });
  }

  update(
    id: string,
    data: Prisma.OrganizationUpdateInput,
  ): Promise<Organization> {
    return this.prisma.organization.update({
      where: { id },
      data,
    });
  }

  delete(id: string): Promise<Organization> {
    return this.prisma.organization.delete({
      where: { id },
    });
  }

  // Member management methods
  findMembers(organizationId: string): Promise<Member[]> {
    return this.prisma.member.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { role: 'asc' }, // OWNER first
        { joinedAt: 'asc' },
      ],
    });
  }

  findMemberById(memberId: string): Promise<Member | null> {
    return this.prisma.member.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  findMemberByUserAndOrg(
    userId: string,
    organizationId: string,
  ): Promise<Member | null> {
    return this.prisma.member.findFirst({
      where: {
        userId,
        organizationId,
      },
    });
  }

  async createMember(data: Prisma.MemberCreateInput): Promise<Member> {
    return this.prisma.member.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async updateMember(
    memberId: string,
    data: Prisma.MemberUpdateInput,
  ): Promise<Member> {
    return this.prisma.member.update({
      where: { id: memberId },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async deleteMember(memberId: string): Promise<Member> {
    return this.prisma.member.delete({
      where: { id: memberId },
    });
  }

  async countOwners(organizationId: string): Promise<number> {
    return this.prisma.member.count({
      where: {
        organizationId,
        role: 'OWNER',
      },
    });
  }

  async countUserOwnerships(userId: string): Promise<number> {
    return this.prisma.member.count({
      where: {
        userId,
        role: 'OWNER',
      },
    });
  }
}
