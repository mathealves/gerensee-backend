import { IsString, IsNotEmpty, MinLength, MaxLength, IsObject, IsOptional } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsObject()
  @IsOptional()
  content?: Record<string, unknown>;
}
