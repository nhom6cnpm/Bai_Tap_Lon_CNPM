import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface User {
  id: string;
  email: string;
  password?: string;
}

@Injectable()
export class AuthService {
  // Mock user database
  private users: User[] = [];

  constructor(private jwtService: JwtService) { }

  async register(registerDto: RegisterDto) {
    const { email, password } = registerDto;

    if (!email || !password) {
      throw new UnauthorizedException('Email and password are required');
    }

    // Check if user exists
    const existingUser = this.users.find((u) => u.email === email);
    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user (using mock data, replace with DB later)
    const newUser = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
    };

    this.users.push(newUser);

    // Don't return password
    const { password: _, ...result } = newUser;
    return result;
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = this.users.find((u) => u.email === email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
