import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { FindOperator } from 'typeorm';
import request from 'supertest';
import { Product } from './product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { InventoryService } from '../inventory/inventory.service';
import { Ingredient } from '../inventory/ingredient.entity';
import { RecipeItem } from '../inventory/recipe-item.entity';
import { ToppingRecipe } from '../inventory/topping-recipe.entity';

describe('availability HTTP API (in-memory repositories)', () => {
  let app: INestApplication;
  const ingredients = [
    { id: 'coffee', quantity: 100 },
    { id: 'cream', quantity: 40 },
  ];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        ProductsService,
        InventoryService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            findBy: ({ id }: { id: FindOperator<string[]> }) =>
              ['1', '2']
                .filter((value) => id.value.includes(value))
                .map((value) => ({ id: value })),
          },
        },
        {
          provide: getRepositoryToken(Ingredient),
          useValue: { find: () => ingredients },
        },
        {
          provide: getRepositoryToken(RecipeItem),
          useValue: {
            find: () => [
              { productId: '1', ingredientId: 'coffee', amount: 20 },
              { productId: '2', ingredientId: 'coffee', amount: 10 },
            ],
          },
        },
        {
          provide: getRepositoryToken(ToppingRecipe),
          useValue: {
            find: () => [
              { toppingId: 'cream', ingredientId: 'cream', amount: 20 },
            ],
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('defaults to S without toppings and prevents HTTP caching', async () => {
    const result = await request(app.getHttpServer())
      .get('/products/1/availability')
      .expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).toEqual({
      productId: '1',
      size: 'S',
      toppingIds: [],
      stock: 5,
    });
  });

  it('accepts size and comma-separated toppings', async () => {
    const result = await request(app.getHttpServer())
      .get('/products/1/availability?size=L&toppingIds=cream')
      .expect(200);
    expect(result.body).toMatchObject({
      size: 'L',
      toppingIds: ['cream'],
      stock: 2,
    });
  });

  it.each([
    'size=XL',
    'toppingIds=invalid',
    'toppingIds=cream,cream',
    'extra=1',
  ])('rejects invalid query %s', async (query) => {
    await request(app.getHttpServer())
      .get(`/products/1/availability?${query}`)
      .expect(400);
  });

  it('returns 404 for an unknown product', async () => {
    await request(app.getHttpServer())
      .get('/products/missing/availability')
      .expect(404);
  });

  it('checks all lines together and never changes ingredient quantities', async () => {
    const payload = {
      items: [
        { productId: '1', size: 'S', toppingIds: [], qty: 5 },
        { productId: '2', size: 'S', toppingIds: [], qty: 1 },
      ],
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await request(app.getHttpServer())
        .post('/products/availability')
        .send(payload)
        .expect(200);
      expect(result.body.available).toBe(false);
      expect(
        result.body.items.map((item: { stock: number }) => item.stock),
      ).toEqual([4, 0]);
    }
    expect(ingredients.map((item) => item.quantity)).toEqual([100, 40]);
  });

  it.each([
    { items: [] },
    { items: [{ productId: '1', size: 'XL', toppingIds: [], qty: 1 }] },
    {
      items: [
        { productId: '1', size: 'S', toppingIds: ['cream', 'cream'], qty: 1 },
      ],
    },
    { items: [{ productId: '1', size: 'S', toppingIds: [], qty: 0 }] },
    { items: [{ productId: '1', size: 'S', toppingIds: [], qty: 1.5 }] },
    { items: [{ productId: '1', size: 'S', toppingIds: ['missing'], qty: 1 }] },
  ])('validates nested cart lines: %j', async (payload) => {
    await request(app.getHttpServer())
      .post('/products/availability')
      .send(payload)
      .expect(400);
  });
});
