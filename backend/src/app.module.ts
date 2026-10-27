import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { Product } from './products/product.entity';
import { User } from './auth/user.entity';
import { Order } from './orders/order.entity';
import { OrderItem } from './orders/order-item.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';
        const dbHost = configService.get<string>('DB_HOST');
        const databaseUrl = configService.get<string>('DATABASE_URL');

        if (dbHost) {
          return {
            type: 'postgres',
            host: dbHost,
            port: parseInt(configService.get<string>('DB_PORT', '5432'), 10),
            username: configService.get<string>('DB_USERNAME', 'brewlite'),
            password: configService.get<string>('DB_PASSWORD', 'brewlite'),
            database: configService.get<string>('DB_NAME', 'brewlite'),
            entities: [Product, User, Order, OrderItem],
            synchronize: !isProduction,
            logging: !isProduction,
          };
        }

        return {
          type: 'postgres',
          url:
            databaseUrl ||
            'postgresql://brewlite:brewlite@localhost:5432/brewlite',
          entities: [Product, User, Order, OrderItem],
          synchronize: !isProduction,
          logging: !isProduction,
        };
      },
    }),
    ProductsModule,
    AuthModule,
    OrdersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
