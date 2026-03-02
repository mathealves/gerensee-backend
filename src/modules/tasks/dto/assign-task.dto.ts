import { IsNotEmpty, IsString } from 'class-validator';

export class AssignTaskDto {
  @IsString()
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;
}
