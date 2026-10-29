import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentCallbackDto } from './dto/payment-callback.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest {
  user: { userId: string; email: string };
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  getPayment(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.paymentsService.getPaymentById(id, req.user.userId);
  }

  @Post('callback')
  callback(@Body() dto: PaymentCallbackDto) {
    return this.paymentsService.processCallback(dto);
  }
}
