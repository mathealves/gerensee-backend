import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { DocumentsRepository } from './repositories/documents.repository';
import type { CreateDocumentDto, UpdateDocumentDto } from './dto';
import type { CurrentUserType } from '../../core/auth/decorators/current-user.decorator';
import { Document, DocumentLock } from '../../generated/prisma/client';

const MAX_CONTENT_BYTES = 10 * 1024 * 1024; // 10MB

const EMPTY_DOC_CONTENT = { type: 'doc', content: [] };

@Injectable()
export class DocumentsService {
  constructor(
    private readonly repository: DocumentsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    user: CurrentUserType,
    projectId: string,
    dto: CreateDocumentDto,
  ): Promise<Document> {
    await this.requireProjectAccess(user, projectId);

    const content = dto.content ?? EMPTY_DOC_CONTENT;
    this.validateTiptapContent(content);
    this.validateContentSize(content);

    return this.repository.create({
      title: dto.title,
      content: content as object,
      projectId,
      organizationId: user.organizationId,
      createdById: user.id,
    });
  }

  async findAll(user: CurrentUserType, projectId: string) {
    await this.requireProjectAccess(user, projectId);
    const docs = await this.repository.findAllInProject(projectId);

    return docs.map((doc) => ({
      ...doc,
      isLocked: !!doc.lock && doc.lock.expiresAt > new Date(),
      lockedBy: doc.lock ? doc.lock.projectMember.member.user : null,
      lock: undefined, // strip nested lock; expose isLocked/lockedBy only
    }));
  }

  async findOne(user: CurrentUserType, documentId: string): Promise<Document> {
    const doc = await this.repository.findOneInOrg(
      documentId,
      user.organizationId,
    );
    if (!doc) throw new NotFoundException('Document not found');

    await this.requireProjectAccess(user, doc.projectId);
    return doc;
  }

  async update(
    user: CurrentUserType,
    documentId: string,
    dto: UpdateDocumentDto,
  ): Promise<Document> {
    const doc = await this.repository.findOneInOrg(
      documentId,
      user.organizationId,
    );
    if (!doc) throw new NotFoundException('Document not found');

    await this.requireProjectAccess(user, doc.projectId);

    // If content is being updated, caller must hold a valid lock
    if (dto.content !== undefined) {
      const pm = await this.getProjectMember(user, doc.projectId);
      const lock = await this.repository.findActiveLock(documentId);

      if (!lock) {
        throw new ForbiddenException(
          'Document must be locked before editing content',
        );
      }
      if (lock.projectMemberId !== pm.id) {
        throw new ForbiddenException(
          'You do not hold the lock for this document',
        );
      }

      this.validateTiptapContent(dto.content);
      this.validateContentSize(dto.content);
    }

    return this.repository.update(documentId, {
      title: dto.title,
      content: dto.content as object | undefined,
    });
  }

  async delete(user: CurrentUserType, documentId: string): Promise<void> {
    const doc = await this.repository.findOneInOrg(
      documentId,
      user.organizationId,
    );
    if (!doc) throw new NotFoundException('Document not found');

    await this.requireProjectAccess(user, doc.projectId);
    await this.repository.delete(documentId, user.id);
  }

  // --- Lock Operations ---

  async lockDocument(
    user: CurrentUserType,
    documentId: string,
  ): Promise<DocumentLock> {
    const doc = await this.repository.findOneInOrg(
      documentId,
      user.organizationId,
    );
    if (!doc) throw new NotFoundException('Document not found');

    await this.requireProjectAccess(user, doc.projectId);
    const pm = await this.getProjectMember(user, doc.projectId);

    const existingLock = await this.repository.findActiveLock(documentId);
    if (existingLock) {
      if (existingLock.projectMemberId === pm.id) {
        // Already locked by this user — extend and return
        return this.repository.extendLock(documentId);
      }
      const lockerUser = (existingLock as any).projectMember?.member?.user;
      const lockerName = lockerUser?.name ?? 'another user';
      throw new ConflictException(
        `Document is locked by ${lockerName} until ${existingLock.expiresAt.toISOString()}`,
      );
    }

    return this.repository.createLock(documentId, pm.id);
  }

  async unlockDocument(
    user: CurrentUserType,
    documentId: string,
  ): Promise<void> {
    const doc = await this.repository.findOneInOrg(
      documentId,
      user.organizationId,
    );
    if (!doc) throw new NotFoundException('Document not found');

    const lock = await this.repository.findActiveLock(documentId);
    if (!lock) throw new NotFoundException('No active lock on this document');

    const pm = await this.getProjectMember(user, doc.projectId);
    if (lock.projectMemberId !== pm.id) {
      throw new ForbiddenException(
        'You do not hold the lock for this document',
      );
    }

    await this.repository.deleteLockByDocument(documentId);
  }

  async extendLock(
    user: CurrentUserType,
    documentId: string,
  ): Promise<DocumentLock> {
    const doc = await this.repository.findOneInOrg(
      documentId,
      user.organizationId,
    );
    if (!doc) throw new NotFoundException('Document not found');

    const lock = await this.repository.findActiveLock(documentId);
    if (!lock) throw new NotFoundException('No active lock on this document');

    const pm = await this.getProjectMember(user, doc.projectId);
    if (lock.projectMemberId !== pm.id) {
      throw new ForbiddenException(
        'You do not hold the lock for this document',
      );
    }

    return this.repository.extendLock(documentId);
  }

  // --- Helpers ---

  private validateTiptapContent(content: Record<string, unknown>): void {
    if (
      typeof content !== 'object' ||
      content === null ||
      content['type'] !== 'doc'
    ) {
      throw new BadRequestException(
        'Content must be a valid Tiptap document JSON with type "doc"',
      );
    }
  }

  private validateContentSize(content: Record<string, unknown>): void {
    const bytes = Buffer.byteLength(JSON.stringify(content), 'utf8');
    if (bytes > MAX_CONTENT_BYTES) {
      throw new BadRequestException(`Content exceeds maximum size of 10MB`);
    }
  }

  private async requireProjectAccess(
    user: CurrentUserType,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId: user.organizationId },
    });
    if (!project) throw new NotFoundException('Project not found');

    if (user.role === 'MEMBER') {
      const member = await this.prisma.member.findFirst({
        where: { userId: user.id, organizationId: user.organizationId },
      });
      if (!member)
        throw new ForbiddenException('Organization membership not found');

      const projectMember = await this.prisma.projectMember.findFirst({
        where: { projectId, memberId: member.id },
      });
      if (!projectMember) {
        throw new ForbiddenException(
          'Access denied: not a member of this project',
        );
      }
    }
  }

  private async getProjectMember(user: CurrentUserType, projectId: string) {
    const member = await this.prisma.member.findFirst({
      where: { userId: user.id, organizationId: user.organizationId },
    });
    if (!member)
      throw new ForbiddenException('Organization membership not found');

    const pm = await this.prisma.projectMember.findFirst({
      where: { projectId, memberId: member.id },
    });
    if (!pm) throw new ForbiddenException('Not a project member');
    return pm;
  }
}
