import { Body, Controller, Header, HttpCode, Post } from '@nestjs/common';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { VouchersService } from './vouchers.service';

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Post('quote')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  quote(@Body() dto: CreateOrderDto) {
    return this.vouchers.quote(dto);
  }
}
