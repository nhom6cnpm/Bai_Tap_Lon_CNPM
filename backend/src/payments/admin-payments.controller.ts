import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { PaymentsService } from './payments.service';
import { ListAdminPaymentsDto } from './dto/list-admin-payments.dto';
import { ReviewPaymentDto } from './dto/review-payment.dto';

interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

// Store staff only: customers get 403
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  list(@Query() query: ListAdminPaymentsDto) {
    return this.paymentsService.listForAdmin(query);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto?: ReviewPaymentDto,
  ) {
    return this.paymentsService.review(
      req.user.userId,
      id,
      'CONFIRM',
      dto?.note,
    );
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto?: ReviewPaymentDto,
  ) {
    return this.paymentsService.review(
      req.user.userId,
      id,
      'REJECT',
      dto?.note,
    );
  }
}
