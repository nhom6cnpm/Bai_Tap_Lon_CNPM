import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Ingredient } from './ingredient.entity';
import { RecipeItem } from './recipe-item.entity';
import { ToppingRecipe } from './topping-recipe.entity';
import { selectionAvailability } from './selection-availability';
import {
  type IngredientAmounts,
  type OrderLine,
  type RecipeBook,
  type RecipeEntry,
  requiredForLines,
  requiredPerCup,
  sellableCups,
} from './recipe-calculator';

function groupBy<T>(
  rows: readonly T[],
  key: (row: T) => string,
  toEntry: (row: T) => RecipeEntry,
): Map<string, RecipeEntry[]> {
  const groups = new Map<string, RecipeEntry[]>();
  for (const row of rows) {
    const list = groups.get(key(row)) ?? [];
    list.push(toEntry(row));
    groups.set(key(row), list);
  }
  return groups;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Ingredient)
    private readonly ingredientRepository: Repository<Ingredient>,
    @InjectRepository(RecipeItem)
    private readonly recipeRepository: Repository<RecipeItem>,
    @InjectRepository(ToppingRecipe)
    private readonly toppingRecipeRepository: Repository<ToppingRecipe>,
  ) {}

  async getRecipeBook(manager?: EntityManager): Promise<RecipeBook> {
    const [recipes, toppingRecipes] = await Promise.all([
      (manager?.getRepository(RecipeItem) ?? this.recipeRepository).find(),
      (
        manager?.getRepository(ToppingRecipe) ?? this.toppingRecipeRepository
      ).find(),
    ]);
    const toEntry = (row: RecipeItem | ToppingRecipe): RecipeEntry => ({
      ingredientId: row.ingredientId,
      amount: row.amount,
    });
    return {
      products: groupBy(recipes, (r) => r.productId, toEntry),
      toppings: groupBy(toppingRecipes, (r) => r.toppingId, toEntry),
    };
  }

  async getStockMap(): Promise<Map<string, number>> {
    const ingredients = await this.ingredientRepository.find();
    return new Map(ingredients.map((i) => [i.id, i.quantity]));
  }

  /** Cups still sellable per product (size S, no topping) — shown as `stock` on the menu. */
  async getSellableCups(
    productIds: readonly string[],
  ): Promise<Map<string, number>> {
    const [book, stock] = await Promise.all([
      this.getRecipeBook(),
      this.getStockMap(),
    ]);
    return new Map(
      productIds.map((id) => [
        id,
        sellableCups(requiredPerCup(book, id, 'S', []), stock),
      ]),
    );
  }

  /** Total ingredients an order needs (for deducting stock when an order is created). */
  async getRequiredIngredients(
    lines: readonly OrderLine[],
  ): Promise<IngredientAmounts> {
    return requiredForLines(await this.getRecipeBook(), lines);
  }

  /** Read-only preview; creating an order still needs an atomic stock check. */
  async getAvailability(lines: readonly OrderLine[]) {
    const [book, stock] = await Promise.all([
      this.getRecipeBook(),
      this.getStockMap(),
    ]);
    return selectionAvailability(book, stock, lines);
  }

  /** Caller owns the transaction: a later shortage rolls back all earlier deductions. */
  async reserveIngredients(
    lines: readonly OrderLine[],
    manager: EntityManager,
  ) {
    const book = await this.getRecipeBook(manager);
    for (const line of lines) {
      if (
        !book.products.get(line.productId)?.length ||
        line.toppingIds.some((id) => !book.toppings.get(id)?.length)
      ) {
        throw new BadRequestException(
          'Món hoặc topping chưa có công thức nguyên liệu',
        );
      }
    }
    const amounts = requiredForLines(book, lines);
    const repository = manager.getRepository(Ingredient);
    // Every transaction touches ingredients in the same order to avoid deadlocks.
    for (const [ingredientId, amount] of [...amounts].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (
        !Number.isSafeInteger(amount) ||
        amount <= 0 ||
        amount > 2_147_483_647
      ) {
        throw new BadRequestException(
          'Số lượng nguyên liệu yêu cầu không hợp lệ',
        );
      }
      let reserved = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        const ingredient = await repository.findOneBy({ id: ingredientId });
        if (!ingredient || ingredient.quantity < amount) {
          throw new BadRequestException(
            `${ingredient?.name ?? ingredientId} không đủ nguyên liệu`,
          );
        }
        const result = await repository
          .createQueryBuilder()
          .update(Ingredient)
          .set({
            quantity: () => '"quantity" - :amount',
            version: () => '"version" + 1',
          })
          .where(
            '"id" = :id AND "version" = :version AND "quantity" >= :amount',
            {
              id: ingredientId,
              version: ingredient.version,
              amount,
            },
          )
          .execute();
        if (result.affected === 1) {
          reserved = true;
          break;
        }
        // A concurrent writer won. Read its committed quantity/version before retrying.
      }
      if (!reserved) {
        throw new ConflictException('Tồn kho đang thay đổi, vui lòng thử lại');
      }
    }
    return amounts;
  }

  /** Atomic increments preserve concurrent reservations and advance their versions. */
  async releaseIngredients(
    amounts: ReadonlyMap<string, number>,
    manager: EntityManager,
  ) {
    for (const [id, amount] of [...amounts].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const result = await manager
        .getRepository(Ingredient)
        .createQueryBuilder()
        .update(Ingredient)
        .set({
          quantity: () => '"quantity" + :amount',
          version: () => '"version" + 1',
        })
        .where('"id" = :id', { id, amount })
        .execute();
      if (result.affected !== 1) {
        throw new ConflictException('Không thể hoàn nguyên liệu cho đơn hàng');
      }
    }
  }
}
