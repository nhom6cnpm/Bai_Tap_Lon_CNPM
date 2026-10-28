import { Entity, PrimaryColumn, Column, VersionColumn } from 'typeorm';

@Entity('ingredients')
export class Ingredient {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  // 'g' or 'ml'
  @Column({ type: 'varchar', length: 16 })
  unit!: string;

  @Column({ type: 'int', default: 0 })
  quantity!: number;

  // Optimistic locking: incremented on every update (used when deducting stock)
  @VersionColumn()
  version!: number;
}
