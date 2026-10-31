import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles';
import { BankLedgerService } from './bank-ledger.service';

export class ListBankTransactionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;
}

/** GET /admin/bank-transactions — sao kê tài khoản của quán (chỉ ADMIN). */
@Controller('admin/bank-transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminBankController {
  constructor(private readonly ledger: BankLedgerService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query() query: ListBankTransactionsDto) {
    return this.ledger.list(query.orderId?.trim() || undefined);
  }
}
