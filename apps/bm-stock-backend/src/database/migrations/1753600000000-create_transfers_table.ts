import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransfersTable1753600000000 implements MigrationInterface {
  name = 'CreateTransfersTable1753600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "transfers_type_enum" AS ENUM ('warehouse_to_shop', 'shop_to_warehouse')
    `);
    await queryRunner.query(`
      CREATE TYPE "transfers_status_enum" AS ENUM ('pending', 'approved', 'rejected', 'completed', 'cancelled')
    `);
    await queryRunner.query(`
      CREATE TABLE "transfers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" "transfers_type_enum" NOT NULL,
        "status" "transfers_status_enum" NOT NULL DEFAULT 'pending',
        "quantity" integer NOT NULL,
        "note" text,
        "rejection_reason" text,
        "product_id" uuid NOT NULL,
        "from_warehouse_id" uuid,
        "to_warehouse_id" uuid,
        "from_shop_id" uuid,
        "to_shop_id" uuid,
        "requested_by_id" uuid NOT NULL,
        "approved_by_id" uuid,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_transfers" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "transfers" ADD CONSTRAINT "FK_transfers_product"
        FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "transfers" ADD CONSTRAINT "FK_transfers_from_warehouse"
        FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "transfers" ADD CONSTRAINT "FK_transfers_to_warehouse"
        FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "transfers" ADD CONSTRAINT "FK_transfers_from_shop"
        FOREIGN KEY ("from_shop_id") REFERENCES "shops"("id") ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "transfers" ADD CONSTRAINT "FK_transfers_to_shop"
        FOREIGN KEY ("to_shop_id") REFERENCES "shops"("id") ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "transfers" ADD CONSTRAINT "FK_transfers_requested_by"
        FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "transfers" ADD CONSTRAINT "FK_transfers_approved_by"
        FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE NO ACTION
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transfers_status" ON "transfers" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transfers_type" ON "transfers" ("type")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_transfers_product" ON "transfers" ("product_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "transfers"`);
    await queryRunner.query(`DROP TYPE "transfers_status_enum"`);
    await queryRunner.query(`DROP TYPE "transfers_type_enum"`);
  }
}
