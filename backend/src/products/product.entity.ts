import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'int' })
  price!: number;

  @Column({ type: 'varchar', length: 500 })
  imageUrl!: string;

  @Column({ type: 'int', default: 0 })
  stock!: number;
}
