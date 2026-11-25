import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProductBorrowings1757000009000 implements MigrationInterface {
  name = 'CreateProductBorrowings1757000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "product_borrowings_status_enum" AS ENUM ('active', 'partially_returned', 'fully_returned')
    `);
    await queryRunner.query(`
      CREATE TABLE "product_borrowings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "company_id" uuid NOT NULL,
        "product_name" varchar(255) NOT NULL,
        "product_category" varchar(120),
        "product_id" uuid,
        "quantity_taken" integer NOT NULL,
        "quantity_returned" integer NOT NULL DEFAULT 0,
        "seller_name" varchar(255) NOT NULL,
        "seller_phone" varchar(30),
        "date_taken" date NOT NULL,
        "expected_return_date" date,
        "note" text,
        "warehouse_id" uuid,
        "shop_id" uuid,
        "status" "product_borrowings_status_enum" NOT NULL DEFAULT 'active',
        "recorded_by_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_product_borrowings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "product_borrowings" ADD CONSTRAINT "FK_borrowings_company"
        FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "product_borrowings" ADD CONSTRAINT "FK_borrowings_product"
        FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "product_borrowings" ADD CONSTRAINT "FK_borrowings_warehouse"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "product_borrowings" ADD CONSTRAINT "FK_borrowings_shop"
        FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "product_borrowings" ADD CONSTRAINT "FK_borrowings_recorded_by"
        FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_borrowings_company" ON "product_borrowings" ("company_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_borrowings_status" ON "product_borrowings" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "product_borrowings"`);
    await queryRunner.query(`DROP TYPE "product_borrowings_status_enum"`);
  }
}
