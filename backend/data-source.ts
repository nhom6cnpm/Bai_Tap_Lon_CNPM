import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Product } from './src/products/product.entity';
import { User } from './src/auth/user.entity';
import { Order } from './src/orders/order.entity';
import { OrderItem } from './src/orders/order-item.entity';
import { Ingredient } from './src/inventory/ingredient.entity';
import { RecipeItem } from './src/inventory/recipe-item.entity';
import { ToppingRecipe } from './src/inventory/topping-recipe.entity';
import { Payment } from './src/payments/entities/payment.entity';
import { OrderInventoryReservation } from './src/orders/order-inventory-reservation.entity';
import { Voucher } from './src/vouchers/voucher.entity';
import { PaymentRequestKey } from './src/payments/entities/payment-request-key.entity';
import { BankTransaction } from './src/mock-bank/bank-transaction.entity';
import { OrderRequestKey } from './src/orders/order-request-key.entity';
import { VoucherUserQuota } from './src/vouchers/voucher-user-quota.entity';
import { VoucherUsage } from './src/vouchers/voucher-usage.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ??
    'postgresql://brewlite:brewlite@localhost:5432/brewlite',
  entities: [
    Product,
    User,
    Order,
    OrderItem,
    Ingredient,
    RecipeItem,
    ToppingRecipe,
    Payment,
    OrderInventoryReservation,
    Voucher,
    PaymentRequestKey,
    VoucherUserQuota,
    VoucherUsage,
    BankTransaction,
    OrderRequestKey,
  ],
  migrations: ['src/migrations/*{.ts,.js}'],
});
