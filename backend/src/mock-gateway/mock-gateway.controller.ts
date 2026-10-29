import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from '../payments/payments.service';
import { ConfirmMockDto } from './dto/confirm-mock.dto';

@Controller('mock-gateway')
export class MockGatewayController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  @Get(':paymentId')
  getPaymentInfo(@Param('paymentId') paymentId: string) {
    return this.paymentsService.getPaymentForGateway(paymentId);
  }

  @Post(':paymentId/confirm')
  async confirmPayment(
    @Param('paymentId') paymentId: string,
    @Body() dto: ConfirmMockDto,
  ) {
    if (dto.result !== 'SUCCESS' && dto.result !== 'FAILED') {
      throw new BadRequestException("result phải là 'SUCCESS' hoặc 'FAILED'");
    }

    const payment = this.paymentsService.getPaymentForGateway(paymentId);
    if (payment.status !== 'PENDING') {
      throw new BadRequestException(
        'Phiên thanh toán này không còn ở trạng thái PENDING',
      );
    }

    const signature = this.paymentsService.generateSignature(
      paymentId,
      dto.result,
    );

    await this.paymentsService.processCallback({
      paymentId,
      result: dto.result,
      signature,
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const returnUrl = `${frontendUrl}/checkout/${payment.orderId}?paymentId=${paymentId}&status=${dto.result}`;

    return {
      success: true,
      result: dto.result,
      returnUrl,
    };
  }
}
