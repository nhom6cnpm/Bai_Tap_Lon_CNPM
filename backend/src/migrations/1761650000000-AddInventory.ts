import { MigrationInterface, QueryRunner } from 'typeorm';

// Task 10b: recipe-based inventory.
// - ingredients / recipe_items / topping_recipes tables + sample data
// - products are seeded here (recipes reference them), so the app no longer seeds on startup
// - products.stock is removed: stock is now computed from ingredients
export class AddInventory1761650000000 implements MigrationInterface {
  name = 'AddInventory1761650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ingredients" (
        "id" character varying(64) NOT NULL,
        "name" character varying(255) NOT NULL,
        "unit" character varying(16) NOT NULL,
        "quantity" integer NOT NULL DEFAULT 0,
        "version" integer NOT NULL DEFAULT 1,
        CONSTRAINT "PK_ingredients" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_ingredients_quantity" CHECK ("quantity" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "recipe_items" (
        "productId" character varying(64) NOT NULL,
        "ingredientId" character varying(64) NOT NULL,
        "amount" integer NOT NULL,
        CONSTRAINT "PK_recipe_items" PRIMARY KEY ("productId", "ingredientId"),
        CONSTRAINT "CHK_recipe_items_amount" CHECK ("amount" > 0),
        CONSTRAINT "FK_recipe_items_product" FOREIGN KEY ("productId")
          REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_recipe_items_ingredient" FOREIGN KEY ("ingredientId")
          REFERENCES "ingredients"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "topping_recipes" (
        "toppingId" character varying(32) NOT NULL,
        "ingredientId" character varying(64) NOT NULL,
        "amount" integer NOT NULL,
        CONSTRAINT "PK_topping_recipes" PRIMARY KEY ("toppingId", "ingredientId"),
        CONSTRAINT "CHK_topping_recipes_amount" CHECK ("amount" > 0),
        CONSTRAINT "FK_topping_recipes_ingredient" FOREIGN KEY ("ingredientId")
          REFERENCES "ingredients"("id") ON DELETE RESTRICT
      )
    `);

    // Products (moved from ProductsService startup seed; keeps existing rows)
    await queryRunner.query(`
      INSERT INTO "products" ("id", "name", "price", "imageUrl", "stock") VALUES
        ('1', 'Cà phê sữa', 35000, '/images/coffee.jpg', 0),
        ('2', 'Americano', 40000, '/images/americano.jpg', 0),
        ('3', 'Cappuccino', 45000, '/images/cappuccino.jpg', 0),
        ('4', 'Trà đào', 39000, '/images/peach-tea.jpg', 0),
        ('5', 'Trà vải', 39000, '/images/lychee-tea.jpg', 0),
        ('6', 'Bạc xỉu', 35000, '/images/bac-xiu.jpg', 0)
      ON CONFLICT ("id") DO NOTHING
    `);

    // Sample stock (edit by hand for demos, e.g. UPDATE ingredients SET quantity = ...)
    await queryRunner.query(`
      INSERT INTO "ingredients" ("id", "name", "unit", "quantity") VALUES
        ('coffee', 'Cà phê', 'g', 2000),
        ('condensed-milk', 'Sữa đặc', 'ml', 3000),
        ('fresh-milk', 'Sữa tươi', 'ml', 5000),
        ('tea', 'Trà', 'g', 1000),
        ('peach', 'Đào ngâm', 'g', 2000),
        ('lychee', 'Vải ngâm', 'g', 2000),
        ('sugar-syrup', 'Đường nước', 'ml', 3000),
        ('cream', 'Kem béo', 'g', 1000),
        ('pearls', 'Trân châu', 'g', 2000)
    `);

    // Recipes for one cup at size S (M ×1.25, L ×1.5 — see recipe-calculator.ts)
    await queryRunner.query(`
      INSERT INTO "recipe_items" ("productId", "ingredientId", "amount") VALUES
        ('1', 'coffee', 20), ('1', 'condensed-milk', 30),
        ('2', 'coffee', 18),
        ('3', 'coffee', 18), ('3', 'fresh-milk', 120),
        ('4', 'tea', 5), ('4', 'peach', 60), ('4', 'sugar-syrup', 20),
        ('5', 'tea', 5), ('5', 'lychee', 60), ('5', 'sugar-syrup', 20),
        ('6', 'coffee', 10), ('6', 'condensed-milk', 40), ('6', 'fresh-milk', 60)
    `);

    // Topping ids match frontend/src/lib/productOptions.ts and orders/pricing.ts
    await queryRunner.query(`
      INSERT INTO "topping_recipes" ("toppingId", "ingredientId", "amount") VALUES
        ('cream', 'cream', 20),
        ('pearls', 'pearls', 40)
    `);

    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "stock"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD "stock" integer NOT NULL DEFAULT 100`,
    );
    await queryRunner.query(`DROP TABLE "topping_recipes"`);
    await queryRunner.query(`DROP TABLE "recipe_items"`);
    await queryRunner.query(`DROP TABLE "ingredients"`);
  }
}
