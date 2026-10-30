import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  HttpCode,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  createPayment(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.paymentsService.createPayment(
      req.user.userId,
      dto,
      idempotencyKey,
    );
  }

  @Get(':id')
  getPayment(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.paymentsService.getPaymentById(id, req.user.userId);
  }

  // "Tôi đã chuyển tiền": only notifies staff, the order stays PENDING
  @Post(':id/report-paid')
  @HttpCode(200)
  reportPaid(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.paymentsService.reportPaid(req.user.userId, id);
  }
}
