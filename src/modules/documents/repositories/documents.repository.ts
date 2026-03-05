import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Document,
  DocumentLock,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';

const LOCK_INCLUDE = {
  projectMember: {
    include: {
      member: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  },
};

const DOCUMENT_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  lock: { include: LOCK_INCLUDE },
};

const DOCUMENT_SUMMARY_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  lock: {
    include: {
      projectMember: {
        include: {
          member: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
      },
    },
  },
};

const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Document CRUD ---

  create(data: Prisma.DocumentUncheckedCreateInput): Promise<Document> {
    return this.prisma.document.create({ data, include: DOCUMENT_INCLUDE });
  }

  findAllInProject(projectId: string) {
    return this.prisma.document.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        projectId: true,
        organizationId: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, name: true } },
        lock: {
          select: {
            id: true,
            expiresAt: true,
            projectMember: {
              select: {
                member: {
                  select: {
                    user: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  findOneInOrg(
    documentId: string,
    organizationId: string,
  ): Promise<Document | null> {
    return this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
      include: DOCUMENT_INCLUDE,
    });
  }

  update(
    documentId: string,
    data: Prisma.DocumentUncheckedUpdateInput,
  ): Promise<Document> {
    return this.prisma.document.update({
      where: { id: documentId },
      data,
      include: DOCUMENT_INCLUDE,
    });
  }

  async delete(documentId: string, deletedBy: string): Promise<Document> {
    const doc = await this.prisma.document.delete({
      where: { id: documentId },
    });
    await this.prisma.documentDeletionLog.create({
      data: { documentId, deletedBy },
    });
    return doc;
  }

  // --- Lock Operations ---

  findActiveLock(documentId: string): Promise<DocumentLock | null> {
    return this.prisma.documentLock.findFirst({
      where: {
        documentId,
        expiresAt: { gt: new Date() },
      },
      include: LOCK_INCLUDE,
    });
  }

  createLock(
    documentId: string,
    projectMemberId: string,
  ): Promise<DocumentLock> {
    const expiresAt = new Date(Date.now() + LOCK_DURATION_MS);
    return this.prisma.documentLock.create({
      data: { documentId, projectMemberId, expiresAt },
      include: LOCK_INCLUDE,
    });
  }

  deleteLockByDocument(documentId: string): Promise<DocumentLock> {
    return this.prisma.documentLock.delete({ where: { documentId } });
  }

  extendLock(documentId: string): Promise<DocumentLock> {
    const expiresAt = new Date(Date.now() + LOCK_DURATION_MS);
    return this.prisma.documentLock.update({
      where: { documentId },
      data: { expiresAt },
      include: LOCK_INCLUDE,
    });
  }

  deleteExpiredLocks(): Promise<Prisma.BatchPayload> {
    return this.prisma.documentLock.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
  }
}
