import { Injectable } from '@nestjs/common';

export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
}

@Injectable()
export class ProductsService {
  private readonly products: Product[] = [
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

  findAll(): Product[] {
    return this.products;
  }

  findById(id: string): Product | undefined {
    return this.products.find((product) => product.id === id);
  }
}
