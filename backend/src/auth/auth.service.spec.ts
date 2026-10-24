import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let _jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock_token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    _jwtService = module.get<JwtService>(JwtService);
  });


  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user with loyaltyPoints = 0 and no password in output', async () => {
      const result = await service.register({
        email: 'test@brewlite.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('id');
      expect(result.email).toBe('test@brewlite.com');
      expect(result.loyaltyPoints).toBe(0);
      expect((result as any).password).toBeUndefined();
    });

    it('should throw ConflictException (409) if email is already registered', async () => {
      await service.register({
        email: 'duplicate@brewlite.com',
        password: 'password123',
      });

      await expect(
        service.register({
          email: 'duplicate@brewlite.com',
          password: 'password456',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await service.register({
        email: 'user@brewlite.com',
        password: 'correctPassword',
      });
    });

    it('should return access_token and user info for valid credentials', async () => {
      const res = await service.login({
        email: 'user@brewlite.com',
        password: 'correctPassword',
      });

      expect(res).toHaveProperty('access_token', 'mock_token');
      expect(res.user.email).toBe('user@brewlite.com');
      expect(res.user.loyaltyPoints).toBe(0);
    });

    it('should throw UnauthorizedException (401) for incorrect password', async () => {
      await expect(
        service.login({
          email: 'user@brewlite.com',
          password: 'wrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException (401) for unregistered email', async () => {
      await expect(
        service.login({
          email: 'nonexistent@brewlite.com',
          password: 'anyPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
