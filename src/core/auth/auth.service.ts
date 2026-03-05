import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtPayload } from './strategies/jwt.strategy';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use');
    }

    // Check if organization name already exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { name: dto.organizationName },
    });

    if (existingOrg) {
      throw new ConflictException('Organization name already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user, organization, and member in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
        },
      });

      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName,
        },
      });

      // Create OWNER membership
      const member = await tx.member.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'OWNER',
        },
      });

      return { user, organization, member };
    });

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.organization.id,
      'OWNER',
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
      },
    };
  }

  async login(dto: LoginDto) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Get user's organization membership (primary org)
    const membership = await this.prisma.member.findFirst({
      where: { userId: user.id },
      include: { organization: true },
      orderBy: { joinedAt: 'asc' }, // Use first org joined
    });

    if (!membership) {
      throw new UnauthorizedException('User not member of any organization');
    }

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      user.email,
      membership.organizationId,
      membership.role,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        role: membership.role,
      },
    };
  }

  async refreshAccessToken(dto: RefreshTokenDto) {
    // Find all non-expired refresh tokens
    const tokens = await this.prisma.refreshToken.findMany({
      where: { expiresAt: { gte: new Date() } },
      include: {
        user: {
          include: {
            memberships: {
              include: { organization: true },
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
      },
    });

    // Compare hashes to find matching token (protect against timing attacks)
    let validToken: typeof tokens[0] | null = null;
    for (const token of tokens) {
      const isMatch = await bcrypt.compare(dto.refreshToken, token.tokenHash);
      if (isMatch) {
        validToken = token;
        break;
      }
    }

    if (!validToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check if token was already used (replay attack detection)
    if (validToken.lastUsedAt) {
      // Token already used - possible replay attack
      // Invalidate all tokens for this user
      await this.prisma.refreshToken.deleteMany({
        where: { userId: validToken.userId },
      });
      throw new UnauthorizedException(
        'Refresh token already used (possible replay attack)',
      );
    }

    // Delete old refresh token (rotation)
    await this.prisma.refreshToken.delete({
      where: { id: validToken.id },
    });

    // Get user's current organization membership
    const membership = validToken.user.memberships[0];
    if (!membership) {
      throw new UnauthorizedException('User has no organization membership');
    }

    // Generate new tokens
    const { accessToken, refreshToken } = await this.generateTokens(
      validToken.userId,
      validToken.user.email,
      membership.organizationId,
      membership.role,
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  async logout(dto: RefreshTokenDto) {
    // Find and delete refresh token
    const tokens = await this.prisma.refreshToken.findMany();

    for (const token of tokens) {
      const isMatch = await bcrypt.compare(dto.refreshToken, token.tokenHash);
      if (isMatch) {
        await this.prisma.refreshToken.delete({ where: { id: token.id } });
        return { message: 'Logged out successfully' };
      }
    }

    // Token not found - already expired or invalid
    return { message: 'Logged out successfully' };
  }

  async logoutAllDevices(userId: string) {
    // Delete all refresh tokens for user
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
    return { message: 'Logged out from all devices' };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async generateTokens(
    userId: string,
    email: string,
    organizationId: string,
    role: 'OWNER' | 'ADMIN' | 'MEMBER',
  ) {
    // Generate access token (15 minutes)
    const payload: JwtPayload = {
      sub: userId,
      email,
      organizationId,
      role,
    };

    const accessToken = this.jwtService.sign(payload);

    // Generate refresh token (30 days)
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: refreshTokenHash,
        userId,
        expiresAt: new Date(
          Date.now() + parseInt(process.env.JWT_REFRESH_EXPIRATION || '30') * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return { accessToken, refreshToken };
  }
}
