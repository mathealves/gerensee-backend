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
    
    // Prisma middleware for multi-tenant awareness
    // Note: Actual tenant scoping is handled explicitly in repositories/services
    // This middleware provides logging and can be enhanced for automatic scoping
    this.$use(async (params, next) => {
      const tenantModels = ['Project', 'Task', 'Document'];
      
      // Log queries on tenant-scoped models in development for debugging
      if (process.env.NODE_ENV === 'development' && tenantModels.includes(params.model || '')) {
        const hasOrgId = params.args?.where?.organizationId || params.args?.data?.organizationId;
        if (!hasOrgId && !['aggregate', 'count'].includes(params.action)) {
          console.warn(
            `[Multi-Tenant Warning] Query on ${params.model} without organizationId: ${params.action}`,
            JSON.stringify(params.args)
          );
        }
      }
      
      return next(params);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

