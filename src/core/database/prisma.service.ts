import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * PrismaService with multi-tenant support
 * 
 * Multi-tenancy Strategy:
 * - All tenant-scoped queries must include organizationId
 * - OrganizationId is retrieved from JWT token via @CurrentUser() decorator
 * - Repositories/services are responsible for adding organizationId to queries
 * - This explicit approach is type-safe and prevents accidental cross-tenant access
 * 
 * Tenant-scoped entities: Project, Task, Document
 * Relationship entities: Member, ProjectMember (scoped via foreign keys)
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    const connectionString = configService.get<string>('DATABASE_URL');
    const adapter = new PrismaPg({ connectionString });
    
    super({ 
      adapter,
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

