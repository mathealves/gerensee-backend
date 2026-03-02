import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DocumentsRepository } from './repositories/documents.repository';

@Injectable()
export class DocumentLockScheduler {
  private readonly logger = new Logger(DocumentLockScheduler.name);

  constructor(private readonly repository: DocumentsRepository) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupExpiredLocks(): Promise<void> {
    const result = await this.repository.deleteExpiredLocks();
    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired document lock(s)`);
    }
  }
}
