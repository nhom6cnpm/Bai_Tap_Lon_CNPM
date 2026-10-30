import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankTransaction } from './bank-transaction.entity';
import { BankLedgerService } from './bank-ledger.service';
import { AdminBankController } from './admin-bank.controller';

// No dependency on Orders/Payments, so both can import it without a cycle
@Module({
  imports: [TypeOrmModule.forFeature([BankTransaction])],
  controllers: [AdminBankController],
  providers: [BankLedgerService],
  exports: [BankLedgerService],
})
export class BankLedgerModule {}
