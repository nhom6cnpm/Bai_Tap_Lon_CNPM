import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { ProductsService } from '../products/products.service';
import {
  calculateUnitPrice,
  type ProductSize,
  type ToppingId,
} from './pricing';

export type OrderStatus = 'PENDING';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  size: ProductSize;
  toppingIds: ToppingId[];
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  total: number;
  items: OrderItem[];
  createdAt: Date;
}

@Injectable()
export class OrdersService {
  // Temporary in-memory storage for Sprint 2 (moves to PostgreSQL in Sprint 3)
  private orders: Order[] = [];

  constructor(private readonly productsService: ProductsService) {}

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    const orderId = 'ORD-' + Date.now();
    let total = 0;

    const items: OrderItem[] = createOrderDto.items.map((item, index) => {
      const product = this.productsService.findById(item.productId);
      if (!product) {
        throw new BadRequestException(
          `Sản phẩm ${item.productId} không tồn tại`,
        );
      }

      // Backend recalculates the price; the client price is never trusted
      const unitPrice = calculateUnitPrice(
        product.price,
        item.size,
        item.toppingIds,
      );
      const lineTotal = unitPrice * item.qty;
      total += lineTotal;

      return {
        id: `${orderId}-${index + 1}`,
        orderId,
        productId: item.productId,
        size: item.size,
        toppingIds: item.toppingIds,
        qty: item.qty,
        unitPrice,
        lineTotal,
      };
    });

    const order: Order = {
      id: orderId,
      userId,
      status: 'PENDING',
      total,
      items,
      createdAt: new Date(),
    };
    this.saveOrder(order);

    return {
      message: 'Tạo đơn hàng thành công',
      orderId: order.id,
      total: order.total,
      status: order.status,
      createdAt: order.createdAt,
    };
  }

  private saveOrder(order: Order): void {
    this.orders.push(order);
  }
}
