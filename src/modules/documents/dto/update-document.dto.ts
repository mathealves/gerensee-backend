import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsObject,
} from 'class-validator';

export class UpdateDocumentDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsObject()
  @IsOptional()
  content?: Record<string, unknown>;
}
