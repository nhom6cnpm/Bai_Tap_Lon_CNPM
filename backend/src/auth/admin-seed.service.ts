import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';

/**
 * Creates the store's admin account from ADMIN_EMAIL / ADMIN_PASSWORD on startup
 * (runs after migrations). An existing account with that email is promoted to
 * ADMIN; its password is left unchanged.
 */
@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.configService
      .get<string>('ADMIN_EMAIL')
      ?.toLowerCase()
      .trim();
    const password = this.configService.get<string>('ADMIN_PASSWORD');
    if (!email || !password) {
      this.logger.warn(
        'ADMIN_EMAIL / ADMIN_PASSWORD chưa được đặt: không tạo tài khoản admin',
      );
      return;
    }

    const existing = await this.userRepository.findOneBy({ email });
    if (existing) {
      if (existing.role !== 'ADMIN') {
        existing.role = 'ADMIN';
        await this.userRepository.save(existing);
        this.logger.log(`Đã cấp quyền ADMIN cho ${email}`);
      }
      return;
    }

    await this.userRepository.save(
      this.userRepository.create({
        email,
        passwordHash: await bcrypt.hash(password, 10),
        loyaltyPoints: 0,
        role: 'ADMIN',
      }),
    );
    this.logger.log(`Đã tạo tài khoản admin ${email}`);
  }
}
