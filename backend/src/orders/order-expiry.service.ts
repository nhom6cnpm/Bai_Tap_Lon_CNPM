import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { ORDER_EXPIRY_SCAN_INTERVAL_MS } from './order-expiry';

@Injectable()
export class OrderExpiryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OrderExpiryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running: Promise<void> | null = null;

  constructor(private readonly orders: OrdersService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => this.scan(), ORDER_EXPIRY_SCAN_INTERVAL_MS);
    this.timer.unref();
    this.scan();
  }

  private scan(): void {
    if (this.running) return;
    this.running = this.orders
      .expireUnpaidOrders()
      .then(() => undefined)
      .catch((error: unknown) => {
        this.logger.error(
          'Cannot expire unpaid orders; the next scan will retry',
          error instanceof Error ? error.message : String(error),
        );
      })
      .finally(() => {
        this.running = null;
      });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
