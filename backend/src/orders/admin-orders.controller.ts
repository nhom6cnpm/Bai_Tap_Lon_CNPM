import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
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
import {
  ApproveCancellationDto,
  RejectCancellationDto,
  ListCancellationRequestsDto,
} from './dto/cancellation.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly history: OrderHistoryService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query() query: ListCancellationRequestsDto) {
    return this.history.findCancellationRequests(query.cancelRequestStatus);
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
