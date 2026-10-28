import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Ingredient } from './ingredient.entity';

// Ingredients for one cup of a product at size S
@Entity('recipe_items')
export class RecipeItem {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  productId!: string;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  ingredientId!: string;

  @ManyToOne(() => Ingredient)
  @JoinColumn({ name: 'ingredientId' })
  ingredient!: Ingredient;

  @Column({ type: 'int' })
  amount!: number;
}
