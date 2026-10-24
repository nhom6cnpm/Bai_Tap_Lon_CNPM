import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface User {
  id: string;
  email: string;
  password?: string;
  loyaltyPoints: number;
}

@Injectable()
export class AuthService {
  // Mock user database (temporary in-memory for Sprint 2)
  private users: User[] = [];

  constructor(private jwtService: JwtService) {}

  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;

    if (!email || !password) {
      throw new UnauthorizedException('Email and password are required');
    }

    // Check if user exists -> return 409 ConflictException
    const existingUser = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      throw new ConflictException('Email đã được đăng ký trong hệ thống');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user (using mock data, replace with DB later in Sprint 3)
    const newUser: User = {
      id: Date.now().toString(),
      email: email.toLowerCase(),
      password: hashedPassword,
      loyaltyPoints: 0,
    };

    this.users.push(newUser);

    // Don't return password
    const { password: _, ...result } = newUser;
    return result;
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || !user.password) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
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

  async getProfile(userId: string) {
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    const { password: _, ...result } = user;
    return result;
  }
}

