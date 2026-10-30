import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateOrderDto } from '../orders/dto/create-order.dto';
import { VouchersService } from './vouchers.service';
import { OptionalVoucherAuthGuard } from './optional-voucher-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchers: VouchersService) {}

  @Post('quote')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization')
  @UseGuards(OptionalVoucherAuthGuard)
  quote(
    @Body() dto: CreateOrderDto,
    @Req() request: { user?: AuthenticatedUser },
  ) {
    return this.vouchers.quote(dto, request.user?.userId);
  }
}
