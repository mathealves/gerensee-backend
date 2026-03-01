import { IsEmail, IsEnum } from 'class-validator';
import { Role } from '../../../generated/prisma/client';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(Role)
  role: Role;
}
