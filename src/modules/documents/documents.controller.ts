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
import { DocumentsService } from './documents.service';
import { CreateDocumentDto, UpdateDocumentDto } from './dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import type { CurrentUserType } from '../../core/auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // --- Documents ---

  @Post('projects/:projectId/documents')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documentsService.create(user, projectId, dto);
  }

  @Get('projects/:projectId/documents')
  findAll(
    @CurrentUser() user: CurrentUserType,
    @Param('projectId') projectId: string,
  ) {
    return this.documentsService.findAll(user, projectId);
  }

  @Get('documents/:documentId')
  findOne(
    @CurrentUser() user: CurrentUserType,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.findOne(user, documentId);
  }

  @Patch('documents/:documentId')
  update(
    @CurrentUser() user: CurrentUserType,
    @Param('documentId') documentId: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(user, documentId, dto);
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: CurrentUserType,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.delete(user, documentId);
  }

  // --- Document Locking ---

  @Post('documents/:documentId/lock')
  @HttpCode(HttpStatus.CREATED)
  lockDocument(
    @CurrentUser() user: CurrentUserType,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.lockDocument(user, documentId);
  }

  @Delete('documents/:documentId/lock')
  @HttpCode(HttpStatus.NO_CONTENT)
  unlockDocument(
    @CurrentUser() user: CurrentUserType,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.unlockDocument(user, documentId);
  }

  @Patch('documents/:documentId/lock')
  extendLock(
    @CurrentUser() user: CurrentUserType,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.extendLock(user, documentId);
  }
}
