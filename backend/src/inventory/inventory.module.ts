import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ingredient } from './ingredient.entity';
import { RecipeItem } from './recipe-item.entity';
import { ToppingRecipe } from './topping-recipe.entity';
import { InventoryService } from './inventory.service';
import { AdminInventoryController } from './admin-inventory.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ingredient, RecipeItem, ToppingRecipe])],
  controllers: [AdminInventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
