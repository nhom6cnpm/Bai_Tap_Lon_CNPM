import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsService } from './payments.service';
import { OrdersModule } from '../orders/orders.module';
import { Order } from '../orders/order.entity';
import { User } from '../auth/user.entity';
import { Payment } from './entities/payment.entity';
import { PaymentRequestKey } from './entities/payment-request-key.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, PaymentRequestKey, Order, User]), OrdersModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
