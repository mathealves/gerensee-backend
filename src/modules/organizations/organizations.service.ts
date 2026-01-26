import { Injectable } from '@nestjs/common';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationsRepository } from './repositories/organizations.repository';
import { Organization } from '../../generated/prisma/client';
@Injectable()
export class OrganizationsService {
  constructor(private readonly repository: OrganizationsRepository) {}
  create(data: CreateOrganizationDto): Promise<Organization> {
    return this.repository.create(data);
  }
}
