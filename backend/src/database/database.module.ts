import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrderEntity, OrderItemEntity, UserEntity } from './entities';
import { OrderHistory1792627200000 } from './migrations/1792627200000-order-history';

@Controller('health')
class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check() {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', database: 'ok' };
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [UserEntity, OrderEntity, OrderItemEntity],
        migrations: [OrderHistory1792627200000],
        migrationsRun: true,
        synchronize: false,
        retryAttempts: 3,
      }),
    }),
  ],
  controllers: [HealthController],
})
export class DatabaseModule {}
