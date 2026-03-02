import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { DocumentsRepository } from './repositories/documents.repository';
import { DocumentLockScheduler } from './document-lock.scheduler';

@Module({
  imports: [DatabaseModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository, DocumentLockScheduler],
  exports: [DocumentsService],
})
export class DocumentsModule {}
