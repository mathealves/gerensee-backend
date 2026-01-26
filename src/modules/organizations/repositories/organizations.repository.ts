import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { Prisma, Organization } from '../../../generated/prisma/client';

@Injectable()
export class OrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return this.prisma.client.organization.create({ data });
  }
  OrganizationsRepository;
}
