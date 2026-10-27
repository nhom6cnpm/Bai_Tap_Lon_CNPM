import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { User } from './user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let mockUsers: User[] = [];

  const mockUserRepository = {
    create: jest.fn().mockImplementation((dto) => ({
      id: Date.now().toString(),
      loyaltyPoints: 0,
      createdAt: new Date(),
      ...dto,
    })),
    save: jest.fn().mockImplementation(async (user: User) => {
      mockUsers.push(user);
      return user;
    }),
    findOneBy: jest
      .fn()
      .mockImplementation(
        async (query: {
          email?: string;
          id?: string;
        }): Promise<User | null> => {
          if (query.email) {
            return mockUsers.find((u) => u.email === query.email) ?? null;
          }
          if (query.id) {
            return mockUsers.find((u) => u.id === query.id) ?? null;
          }
          return null;
        },
      ),
  };

  beforeEach(async () => {
    mockUsers = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock_token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
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
      expect((result as any).passwordHash).toBeUndefined();
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
