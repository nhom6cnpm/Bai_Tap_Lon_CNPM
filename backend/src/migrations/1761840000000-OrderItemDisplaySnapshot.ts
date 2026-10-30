import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrderItemDisplaySnapshot1761840000000 implements MigrationInterface {
  name = 'OrderItemDisplaySnapshot1761840000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE order_items ADD COLUMN "productName" varchar(255), ADD COLUMN "productImageUrl" varchar(500)`,
    );
    await queryRunner.query(`UPDATE order_items item SET "productName" = product.name, "productImageUrl" = product."imageUrl"
      FROM products product WHERE product.id = item."productId"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE order_items DROP COLUMN "productName", DROP COLUMN "productImageUrl"',
    );
  }
}
