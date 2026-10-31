import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles';
import { InventoryService } from './inventory.service';

/** Bảng nguyên liệu cho nhân viên (chỉ xem). */
@Controller('admin/ingredients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  overview() {
    return this.inventory.getAdminOverview();
  }
}
