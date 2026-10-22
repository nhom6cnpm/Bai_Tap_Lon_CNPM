import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../database/entities';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async register({ email, password }: RegisterDto) {
    const user = this.users.create({
      email: email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, 10),
    });
    try {
      const saved = await this.users.save(user);
      return { id: saved.id, email: saved.email };
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('Email đã được đăng ký');
      }
      throw error;
    }
  }

  async login({ email, password }: LoginDto) {
    const user = await this.users.findOne({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, passwordHash: true },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }
    return {
      access_token: this.jwtService.sign({ email: user.email, sub: user.id }),
    };
  }
}
