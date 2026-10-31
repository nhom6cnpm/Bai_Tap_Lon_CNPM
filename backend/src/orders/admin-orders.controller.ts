import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { OrdersService } from './orders.service';
import { OrderHistoryService } from './order-history.service';
import { AdminOrderHistoryQueryDto } from './dto/admin-order-history.dto';
import {
  ApproveCancellationDto,
  RejectCancellationDto,
} from './dto/cancellation.dto';
import {
  AdvancePreparationDto,
  ListAdminOrdersDto,
} from './dto/preparation.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly history: OrderHistoryService,
  ) {}

  // Static routes before ':id' routes
  @Get('history')
  @Header('Cache-Control', 'private, no-store')
  historyList(@Query() query: AdminOrderHistoryQueryDto) {
    return this.history.findForAdminHistory(query);
  }

  @Get(':id/detail')
  @Header('Cache-Control', 'private, no-store')
  detail(@Param('id') id: string) {
    return this.history.findAdminDetail(id);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query() query: ListAdminOrdersDto) {
    if (query.status && query.cancelRequestStatus)
      throw new BadRequestException(
        'Vui lòng truy vấn riêng yêu cầu hủy và bảng pha chế.',
      );
    return query.cancelRequestStatus
      ? this.history.findCancellationRequests(query.cancelRequestStatus)
      : this.history.findPreparationOrders(query.status);
  }

  @Patch(':id/status')
  async advance(@Param('id') id: string, @Body() dto: AdvancePreparationDto) {
    await this.orders.advancePreparation(id, dto.status);
    return this.history.findForAdminById(id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async approve(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: ApproveCancellationDto,
  ) {
    await this.orders.reviewCancellation(
      req.user.userId,
      id,
      dto.requestId,
      'APPROVED',
      dto.note,
    );
    return this.history.findForAdminById(id);
  }

  @Post(':id/cancel-request/reject')
  @HttpCode(200)
  async reject(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: RejectCancellationDto,
  ) {
    await this.orders.reviewCancellation(
      req.user.userId,
      id,
      dto.requestId,
      'REJECTED',
      dto.reason,
    );
    return this.history.findForAdminById(id);
  }
}
