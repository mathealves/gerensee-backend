import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

export class CreateTaskStatusDto {
  @IsString()
  @IsNotEmpty({ message: 'Status name is required' })
  @MinLength(1)
  @MaxLength(50, { message: 'Status name must not exceed 50 characters' })
  name: string;

  @IsInt()
  @Min(0)
  position: number;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color (e.g. #2196F3)' })
  color?: string;
}

export class UpdateTaskStatusDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(50, { message: 'Status name must not exceed 50 characters' })
  name?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  position?: number;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color (e.g. #2196F3)' })
  color?: string;
}
