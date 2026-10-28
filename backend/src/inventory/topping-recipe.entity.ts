import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Ingredient } from './ingredient.entity';

// Ingredients used by one topping (not scaled by cup size)
@Entity('topping_recipes')
export class ToppingRecipe {
  @PrimaryColumn({ type: 'varchar', length: 32 })
  toppingId!: string;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  ingredientId!: string;

  @ManyToOne(() => Ingredient)
  @JoinColumn({ name: 'ingredientId' })
  ingredient!: Ingredient;

  @Column({ type: 'int' })
  amount!: number;
}
