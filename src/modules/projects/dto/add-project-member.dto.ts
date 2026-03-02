import { IsNotEmpty, IsString } from 'class-validator';

export class AddProjectMemberDto {
  @IsString()
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;
}
