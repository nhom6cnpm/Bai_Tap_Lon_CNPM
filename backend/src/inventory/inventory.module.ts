import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ingredient } from './ingredient.entity';
import { RecipeItem } from './recipe-item.entity';
import { ToppingRecipe } from './topping-recipe.entity';
import { InventoryService } from './inventory.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ingredient, RecipeItem, ToppingRecipe])],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
