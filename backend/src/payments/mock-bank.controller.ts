import { Controller, Get, Header, HttpCode, Param, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';

/**
 * Ngân hàng giả lập (thay cho app ngân hàng của khách khi demo).
 * No login: the page is opened by scanning the payment QR on a phone. Knowing
 * the random payment id only lets someone pay for that order; it can never
 * confirm the payment — staff still decide on the admin page.
 */
@Controller('mock-bank/payments')
export class MockBankController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  info(@Param('id') id: string) {
    return this.paymentsService.getTransferInfo(id);
  }

  @Post(':id/transfer')
  @HttpCode(200)
  async transfer(@Param('id') id: string) {
    await this.paymentsService.receiveTransfer(id);
    return this.paymentsService.getTransferInfo(id);
  }
}
