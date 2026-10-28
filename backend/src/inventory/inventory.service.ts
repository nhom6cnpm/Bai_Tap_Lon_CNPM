import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ingredient } from './ingredient.entity';
import { RecipeItem } from './recipe-item.entity';
import { ToppingRecipe } from './topping-recipe.entity';
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

  async getRecipeBook(): Promise<RecipeBook> {
    const [recipes, toppingRecipes] = await Promise.all([
      this.recipeRepository.find(),
      this.toppingRecipeRepository.find(),
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
}
