import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './product.entity';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Cà phê sữa',
    price: 35000,
    imageUrl: '/images/coffee.jpg',
    stock: 100,
  },
  {
    id: '2',
    name: 'Americano',
    price: 40000,
    imageUrl: '/images/americano.jpg',
    stock: 100,
  },
  {
    id: '3',
    name: 'Cappuccino',
    price: 45000,
    imageUrl: '/images/cappuccino.jpg',
    stock: 100,
  },
  {
    id: '4',
    name: 'Trà đào',
    price: 39000,
    imageUrl: '/images/peach-tea.jpg',
    stock: 100,
  },
  {
    id: '5',
    name: 'Trà vải',
    price: 39000,
    imageUrl: '/images/lychee-tea.jpg',
    stock: 100,
  },
  {
    id: '6',
    name: 'Bạc xỉu',
    price: 35000,
    imageUrl: '/images/bac-xiu.jpg',
    stock: 100,
  },
];

@Injectable()
export class ProductsService implements OnModuleInit {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async onModuleInit(): Promise<void> {
    // Migrations (migrationsRun: true) already ran before this — tables exist.
    // Any error here (e.g. duplicate key) will surface and fail loudly.
    await this.seedIfEmpty();
  }

  async seedIfEmpty(): Promise<void> {
    const count = await this.productRepository.count();
    if (count === 0) {
      await this.productRepository.save(INITIAL_PRODUCTS);
    }
  }

  async findAll(): Promise<Product[]> {
    return this.productRepository.find({
      order: { id: 'ASC' },
    });
  }

  async findById(id: string): Promise<Product | null> {
    return this.productRepository.findOneBy({ id });
  }
}
