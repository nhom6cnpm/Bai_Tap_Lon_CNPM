import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from './user.entity';

export interface UserProfileResponse {
  id: string;
  email: string;
  loyaltyPoints: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<UserProfileResponse> {
    const { email, password } = registerDto;

    if (!email || !password) {
      throw new UnauthorizedException('Email and password are required');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists -> return 409 ConflictException
    const existingUser = await this.userRepository.findOneBy({
      email: normalizedEmail,
    });
    if (existingUser) {
      throw new ConflictException('Email đã được đăng ký trong hệ thống');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user in PostgreSQL
    const newUser = this.userRepository.create({
      email: normalizedEmail,
      passwordHash: hashedPassword,
      loyaltyPoints: 0,
    });

    const savedUser = await this.userRepository.save(newUser);

    return {
      id: savedUser.id,
      email: savedUser.email,
      loyaltyPoints: savedUser.loyaltyPoints ?? 0,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await this.userRepository.findOneBy({
      email: normalizedEmail,
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // Generate JWT token
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        loyaltyPoints: user.loyaltyPoints ?? 0,
      },
    };
  }

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    return {
      id: user.id,
      email: user.email,
      loyaltyPoints: user.loyaltyPoints ?? 0,
    };
  }
}
