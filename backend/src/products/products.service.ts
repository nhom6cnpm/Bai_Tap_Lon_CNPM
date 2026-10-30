import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from './product.entity';
import { InventoryService } from '../inventory/inventory.service';
import type { OrderLine } from '../inventory/recipe-calculator';
import type { SelectionAvailabilityQuery } from './dto/availability.dto';
import type {
  CartAvailabilityResponseDto,
  SelectionAvailabilityResponseDto,
} from './dto/availability-response.dto';

// `stock` = cups still sellable (size S, no topping), computed from ingredients
export interface ProductWithStock {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
}

const withStock = (product: Product, stock: number): ProductWithStock => ({
  id: product.id,
  name: product.name,
  price: product.price,
  imageUrl: product.imageUrl,
  stock,
});

// Products, ingredients and recipes are seeded by migration 1761650000000-AddInventory
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly inventoryService: InventoryService,
  ) {}

  async findAll(): Promise<ProductWithStock[]> {
    const products = await this.productRepository.find({
      order: { id: 'ASC' },
    });
    const cups = await this.inventoryService.getSellableCups(
      products.map((p) => p.id),
    );
    return products.map((p) => withStock(p, cups.get(p.id) ?? 0));
  }

  async findById(id: string): Promise<ProductWithStock | null> {
    const product = await this.productRepository.findOneBy({ id });
    if (!product) {
      return null;
    }
    const cups = await this.inventoryService.getSellableCups([id]);
    return withStock(product, cups.get(id) ?? 0);
  }

  async getCartAvailability(
    lines: readonly OrderLine[],
  ): Promise<CartAvailabilityResponseDto> {
    const ids = [...new Set(lines.map((line) => line.productId))];
    const products = await this.productRepository.findBy({ id: In(ids) });
    if (products.length !== ids.length) {
      throw new NotFoundException('Sản phẩm không tồn tại');
    }
    return this.inventoryService.getAvailability(lines);
  }

  async getSelectionAvailability(
    id: string,
    query: SelectionAvailabilityQuery,
  ): Promise<SelectionAvailabilityResponseDto> {
    const result = await this.getCartAvailability([
      { productId: id, size: query.size, toppingIds: query.toppingIds, qty: 1 },
    ]);
    const { productId, size, toppingIds, stock } = result.items[0];
    return { productId, size, toppingIds, stock };
  }
}
