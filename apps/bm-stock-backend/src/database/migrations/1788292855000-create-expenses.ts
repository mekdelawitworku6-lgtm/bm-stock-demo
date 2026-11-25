import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExpenses1788292855000 implements MigrationInterface {
  name = 'CreateExpenses1788292855000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        "company_id" uuid,
        "item_name" character varying(255) NOT NULL,
        "category" character varying(120),
        "quantity" integer NOT NULL DEFAULT 1,
        "unit_cost" numeric(14,2) NOT NULL DEFAULT '0',
        "total_cost" numeric(14,2) NOT NULL DEFAULT '0',
        "supplier_name" character varying(255),
        "reference_number" character varying(100),
        "note" text,
        "warehouse_id" uuid,
        "shop_id" uuid,
        "performed_by" uuid,
        CONSTRAINT "PK_expenses" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_company"
        FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_warehouse"
        FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_shop"
        FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "expenses" ADD CONSTRAINT "FK_expenses_performed_by"
        FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`CREATE INDEX "IDX_expenses_company" ON "expenses" ("company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_expenses_created_at" ON "expenses" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "expenses"`);
  }
}
