import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { OrdersService } from '../orders/orders.service';
import { CreatePaymentDto, PaymentMethod } from './dto/create-payment.dto';
import { PaymentCallbackDto, PaymentResult } from './dto/payment-callback.dto';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface Payment {
  id: string;
  orderId: string;
  userId: string;
  idempotencyKey: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PaymentsService {
  private payments: Payment[] = [];

  constructor(
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
  ) {}

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
      throw new ForbiddenException('Bạn không có quyền thanh toán đơn hàng này');
    }

    if (order.status === 'PAID') {
      throw new BadRequestException('Đơn hàng này đã được thanh toán');
    }
    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Đơn hàng đã hết hạn hoặc đã bị hủy');
    }

    const existingPayment = this.payments.find(
      (p) => p.idempotencyKey === idempotencyKey && p.orderId === dto.orderId,
    );
    if (existingPayment) {
      return {
        paymentId: existingPayment.id,
        gatewayUrl: existingPayment.gatewayUrl,
        status: existingPayment.status,
      };
    }

    if (order.status === 'PAYMENT_FAILED') {
      await this.ordersService.updateOrderStatus(order.id, 'PENDING');
    }

    const paymentId = 'PAY-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const gatewayUrl = `${frontendUrl}/mock-gateway/${paymentId}`;

    const newPayment: Payment = {
      id: paymentId,
      orderId: order.id,
      userId,
      idempotencyKey,
      amount: order.total,
      method: dto.method,
      status: 'PENDING',
      gatewayUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.payments.push(newPayment);

    return {
      paymentId: newPayment.id,
      gatewayUrl: newPayment.gatewayUrl,
      status: newPayment.status,
    };
  }

  async getPaymentById(paymentId: string, userId?: string) {
    const payment = this.payments.find((p) => p.id === paymentId);
    if (!payment) {
      throw new NotFoundException(`Không tìm thấy phiên thanh toán ${paymentId}`);
    }

    if (userId && payment.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền xem phiên thanh toán này');
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

  getPaymentForGateway(paymentId: string) {
    const payment = this.payments.find((p) => p.id === paymentId);
    if (!payment) {
      throw new NotFoundException(`Không tìm thấy phiên thanh toán ${paymentId}`);
    }
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
    };
  }

  verifySignature(paymentId: string, result: PaymentResult, signature: string): boolean {
    const secret =
      this.configService.get<string>('PAYMENT_GATEWAY_SECRET') ||
      'brewlite_mock_secret_key_sprint3';
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${paymentId}:${result}`)
      .digest('hex');
    return expected === signature;
  }

  generateSignature(paymentId: string, result: PaymentResult): string {
    const secret =
      this.configService.get<string>('PAYMENT_GATEWAY_SECRET') ||
      'brewlite_mock_secret_key_sprint3';
    return crypto
      .createHmac('sha256', secret)
      .update(`${paymentId}:${result}`)
      .digest('hex');
  }

  async processCallback(dto: PaymentCallbackDto) {
    const isValid = this.verifySignature(dto.paymentId, dto.result, dto.signature);
    if (!isValid) {
      throw new BadRequestException('Chữ ký không hợp lệ (Invalid signature)');
    }

    const payment = this.payments.find((p) => p.id === dto.paymentId);
    if (!payment) {
      throw new NotFoundException(`Không tìm thấy phiên thanh toán ${dto.paymentId}`);
    }

    if (payment.status !== 'PENDING') {
      return {
        message: 'Callback đã được xử lý trước đó',
        paymentId: payment.id,
        status: payment.status,
      };
    }

    payment.updatedAt = new Date();
    if (dto.result === 'SUCCESS') {
      payment.status = 'SUCCESS';
      await this.ordersService.updateOrderStatus(payment.orderId, 'PAID');
    } else {
      payment.status = 'FAILED';
      await this.ordersService.updateOrderStatus(payment.orderId, 'PAYMENT_FAILED');
    }

    return {
      message: 'Xử lý callback thành công',
      paymentId: payment.id,
      status: payment.status,
      orderStatus: dto.result === 'SUCCESS' ? 'PAID' : 'PAYMENT_FAILED',
    };
  }
}
