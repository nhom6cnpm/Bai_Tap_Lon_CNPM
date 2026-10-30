import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { InventoryModule } from '../inventory/inventory.module';
import { OrderInventoryReservation } from './order-inventory-reservation.entity';
import { OrderExpiryService } from './order-expiry.service';
import { OrderHistoryService } from './order-history.service';
import { Payment } from '../payments/entities/payment.entity';
import { User } from '../auth/user.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { VouchersModule } from '../vouchers/vouchers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderInventoryReservation,
      Payment,
      User,
    ]),
    InventoryModule,
    VouchersModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderExpiryService, OrderHistoryService],
  exports: [OrdersService],
})
export class OrdersModule {}
