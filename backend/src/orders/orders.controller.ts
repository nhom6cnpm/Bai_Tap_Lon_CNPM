import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Param,
  HttpCode,
  Get,
  Header,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderHistoryService } from './order-history.service';
import { RequestCancellationDto } from './dto/cancellation.dto';

interface AuthenticatedRequest {
  user: { userId: string; email: string };
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly history: OrderHistoryService,
  ) {}

  @Get('me')
  @Header('Cache-Control', 'private, no-store')
  mine(@Req() req: AuthenticatedRequest) {
    return this.history.findMine(req.user.userId);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  detail(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.history.findOwnById(req.user.userId, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.ordersService.cancelOrder(req.user.userId, id);
  }

  @Post(':id/cancel-request')
  @HttpCode(200)
  async requestCancellation(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RequestCancellationDto,
  ) {
    await this.ordersService.requestCancellation(
      req.user.userId,
      id,
      dto.reason,
    );
    return this.history.findOwnById(req.user.userId, id);
  }

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(req.user.userId, createOrderDto);
  }
}
