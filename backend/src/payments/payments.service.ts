import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { OrdersService } from '../orders/orders.service';
import type { OrderStatus } from '../orders/order-status';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentCallbackDto, PaymentResult } from './dto/payment-callback.dto';
import { Payment, type PaymentStatus } from './entities/payment.entity';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class PaymentsService {
  private readonly gatewaySecret: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    const secret = this.configService.get<string>('PAYMENT_GATEWAY_SECRET');
    if (!secret) {
      throw new Error(
        'PAYMENT_GATEWAY_SECRET is required. Please set it in your .env file.',
      );
    }
    this.gatewaySecret = secret;
  }

  private toSessionResponse(payment: Payment) {
    return {
      paymentId: payment.id,
      gatewayUrl: payment.gatewayUrl,
      status: payment.status,
    };
  }

  async createPayment(
    userId: string,
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey || !idempotencyKey.trim()) {
      throw new BadRequestException('Thiếu header Idempotency-Key');
    }

    const order = await this.ordersService.findById(dto.orderId);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ${dto.orderId}`);
    }

    if (order.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền thanh toán đơn hàng này',
      );
    }

    if (order.status === 'PAID') {
      throw new BadRequestException('Đơn hàng này đã được thanh toán');
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Đơn hàng đã hết hạn hoặc đã bị hủy');
    }

    const existingPayment = await this.paymentRepository.findOneBy({
      idempotencyKey,
      orderId: dto.orderId,
    });
    if (existingPayment) {
      return this.toSessionResponse(existingPayment);
    }

    const paymentId =
      'PAY-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        // Retry: PAYMENT_FAILED -> PENDING first (đề mục 9.1, "thử lại")
        if (order.status === 'PAYMENT_FAILED') {
          await this.ordersService.updateOrderStatus(
            order.id,
            'PENDING',
            manager,
          );
        }
        const payment = manager.getRepository(Payment).create({
          id: paymentId,
          orderId: order.id,
          userId,
          idempotencyKey,
          amount: order.total, // never trust an amount from the client
          method: dto.method,
          status: 'PENDING',
          gatewayUrl: `${frontendUrl}/mock-gateway/${paymentId}`,
        });
        return manager.save(payment);
      });
      return this.toSessionResponse(saved);
    } catch (error) {
      // Same Idempotency-Key sent twice at the same time: the UNIQUE constraint
      // rejects the second insert, so return the session created by the first one
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION
      ) {
        const winner = await this.paymentRepository.findOneBy({
          idempotencyKey,
        });
        if (winner && winner.orderId === dto.orderId) {
          return this.toSessionResponse(winner);
        }
        throw new BadRequestException(
          'Idempotency-Key đã được dùng cho đơn hàng khác',
        );
      }
      throw error;
    }
  }

  async getPaymentById(paymentId: string, userId?: string) {
    const payment = await this.paymentRepository.findOneBy({ id: paymentId });
    if (!payment) {
      throw new NotFoundException(
        `Không tìm thấy phiên thanh toán ${paymentId}`,
      );
    }

    if (userId && payment.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền xem phiên thanh toán này',
      );
    }

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount,
      method: payment.method,
      gatewayUrl: payment.gatewayUrl,
    };
  }

  async getPaymentForGateway(paymentId: string) {
    const payment = await this.paymentRepository.findOneBy({ id: paymentId });
    if (!payment) {
      throw new NotFoundException(
        `Không tìm thấy phiên thanh toán ${paymentId}`,
      );
    }
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
    };
  }

  generateSignature(paymentId: string, result: PaymentResult): string {
    return crypto
      .createHmac('sha256', this.gatewaySecret)
      .update(`${paymentId}:${result}`)
      .digest('hex');
  }

  verifySignature(
    paymentId: string,
    result: PaymentResult,
    signature: string,
  ): boolean {
    const expected = Buffer.from(this.generateSignature(paymentId, result));
    const received = Buffer.from(signature);
    // Constant-time comparison to avoid leaking the signature through timing
    return (
      expected.length === received.length &&
      crypto.timingSafeEqual(expected, received)
    );
  }

  async processCallback(dto: PaymentCallbackDto) {
    if (!this.verifySignature(dto.paymentId, dto.result, dto.signature)) {
      throw new BadRequestException('Chữ ký không hợp lệ (Invalid signature)');
    }

    const targetOrderStatus: OrderStatus =
      dto.result === 'SUCCESS' ? 'PAID' : 'PAYMENT_FAILED';
    const targetPaymentStatus: PaymentStatus =
      dto.result === 'SUCCESS' ? 'SUCCESS' : 'FAILED';

    // Payment and order are updated together: either both change or neither does
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Payment);
      // Row lock: a duplicate callback arriving at the same time waits here,
      // then sees the payment is no longer PENDING
      const payment = await repository.findOne({
        where: { id: dto.paymentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) {
        throw new NotFoundException(
          `Không tìm thấy phiên thanh toán ${dto.paymentId}`,
        );
      }

      if (payment.status !== 'PENDING') {
        return {
          message: 'Callback đã được xử lý trước đó',
          paymentId: payment.id,
          status: payment.status,
        };
      }

      payment.status = targetPaymentStatus;
      await repository.save(payment);
      await this.ordersService.updateOrderStatus(
        payment.orderId,
        targetOrderStatus,
        manager,
      );

      return {
        message: 'Xử lý callback thành công',
        paymentId: payment.id,
        status: payment.status,
        orderStatus: targetOrderStatus,
      };
    });
  }
}
