import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty({ message: 'Project name is required' })
  @MinLength(2, { message: 'Project name must be at least 2 characters' })
  @MaxLength(200, { message: 'Project name must not exceed 200 characters' })
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000, {
    message: 'Project description must not exceed 1000 characters',
  })
  description?: string;
}
