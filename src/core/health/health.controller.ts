import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * Health check endpoint. Used by the ALB target group to verify the
   * container is ready to receive traffic.
   */
  @Get()
  @ApiOperation({ summary: 'Service health check' })
  check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
