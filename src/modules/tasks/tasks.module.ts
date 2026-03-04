import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AuthModule } from '../../core/auth/auth.module';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksRepository } from './repositories/tasks.repository';
import { BoardGateway } from './board.gateway';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [DatabaseModule, AuthModule, JwtModule],
  controllers: [TasksController],
  providers: [TasksService, TasksRepository, BoardGateway],
  exports: [TasksService],
})
export class TasksModule {}
