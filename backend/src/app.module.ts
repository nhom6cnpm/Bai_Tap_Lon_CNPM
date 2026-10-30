import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { MockGatewayModule } from './mock-gateway/mock-gateway.module';
import { Product } from './products/product.entity';
import { User } from './auth/user.entity';
import { Order } from './orders/order.entity';
import { OrderItem } from './orders/order-item.entity';
import { Ingredient } from './inventory/ingredient.entity';
import { RecipeItem } from './inventory/recipe-item.entity';
import { ToppingRecipe } from './inventory/topping-recipe.entity';
import { Payment } from './payments/entities/payment.entity';
import { OrderInventoryReservation } from './orders/order-inventory-reservation.entity';
import { Voucher } from './vouchers/voucher.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url:
          configService.get<string>('DATABASE_URL') ??
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
        ],
        // Migrations run automatically on app startup (also handles seed order)
        migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
        migrationsRun: true,
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    ProductsModule,
    AuthModule,
    OrdersModule,
    PaymentsModule,
    MockGatewayModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
