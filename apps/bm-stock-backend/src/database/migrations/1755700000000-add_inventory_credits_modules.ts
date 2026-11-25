import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInventoryCreditsModules1755700000000 implements MigrationInterface {
    name = 'AddInventoryCreditsModules1755700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "public"."inventory_transactions_type_enum" AS ENUM(
                'stock_in', 'stock_out', 'adjustment', 'sale', 'return', 'transfer_in', 'transfer_out'
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "inventory_transactions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deletedAt" TIMESTAMP WITH TIME ZONE,
                "type" "public"."inventory_transactions_type_enum" NOT NULL,
                "quantity" integer NOT NULL,
                "previousQuantity" integer,
                "newQuantity" integer,
                "reason" character varying(255),
                "referenceNumber" character varying(100),
                "product_id" uuid NOT NULL,
                "performed_by" uuid,
                "warehouse_id" uuid,
                "shop_id" uuid,
                CONSTRAINT "PK_inventory_transactions" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "inventory_transactions"
            ADD CONSTRAINT "FK_inventory_transactions_product"
            FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "inventory_transactions"
            ADD CONSTRAINT "FK_inventory_transactions_performed_by"
            FOREIGN KEY ("performed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "inventory_transactions"
            ADD CONSTRAINT "FK_inventory_transactions_warehouse"
            FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "inventory_transactions"
            ADD CONSTRAINT "FK_inventory_transactions_shop"
            FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE TYPE "public"."credit_accounts_status_enum" AS ENUM(
                'active', 'paid', 'overdue', 'written_off'
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "credit_accounts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deletedAt" TIMESTAMP WITH TIME ZONE,
                "totalOwed" numeric(12,2) NOT NULL DEFAULT '0',
                "totalPaid" numeric(12,2) NOT NULL DEFAULT '0',
                "interestRate" numeric(5,2) NOT NULL DEFAULT '0',
                "accruedInterest" numeric(12,2) NOT NULL DEFAULT '0',
                "status" "public"."credit_accounts_status_enum" NOT NULL DEFAULT 'active',
                "dueDate" date,
                "lastPaymentDate" date,
                "notes" character varying(255),
                "customer_id" uuid NOT NULL,
                "sale_id" uuid,
                "company_id" uuid,
                CONSTRAINT "PK_credit_accounts" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "credit_accounts"
            ADD CONSTRAINT "FK_credit_accounts_customer"
            FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "credit_accounts"
            ADD CONSTRAINT "FK_credit_accounts_sale"
            FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "credit_accounts"
            ADD CONSTRAINT "FK_credit_accounts_company"
            FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE TABLE "credit_payments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deletedAt" TIMESTAMP WITH TIME ZONE,
                "amount" numeric(12,2) NOT NULL,
                "paymentMethod" character varying(50) NOT NULL DEFAULT 'cash',
                "reference" character varying(100),
                "notes" text,
                "credit_account_id" uuid NOT NULL,
                "received_by" uuid,
                CONSTRAINT "PK_credit_payments" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "credit_payments"
            ADD CONSTRAINT "FK_credit_payments_account"
            FOREIGN KEY ("credit_account_id") REFERENCES "credit_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "credit_payments"
            ADD CONSTRAINT "FK_credit_payments_received_by"
            FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            CREATE TABLE "credit_transactions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deletedAt" TIMESTAMP WITH TIME ZONE,
                "type" character varying(50) NOT NULL,
                "amount" numeric(12,2) NOT NULL,
                "balanceBefore" numeric(12,2) NOT NULL DEFAULT '0',
                "balanceAfter" numeric(12,2) NOT NULL DEFAULT '0',
                "description" text,
                "credit_account_id" uuid NOT NULL,
                CONSTRAINT "PK_credit_transactions" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "credit_transactions"
            ADD CONSTRAINT "FK_credit_transactions_account"
            FOREIGN KEY ("credit_account_id") REFERENCES "credit_accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);

        await queryRunner.query(`CREATE INDEX "IDX_inventory_transactions_product" ON "inventory_transactions" ("product_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_inventory_transactions_type" ON "inventory_transactions" ("type")`);
        await queryRunner.query(`CREATE INDEX "IDX_credit_accounts_customer" ON "credit_accounts" ("customer_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_credit_accounts_status" ON "credit_accounts" ("status")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_credit_accounts_status"`);
        await queryRunner.query(`DROP INDEX "IDX_credit_accounts_customer"`);
        await queryRunner.query(`DROP INDEX "IDX_inventory_transactions_type"`);
        await queryRunner.query(`DROP INDEX "IDX_inventory_transactions_product"`);

        await queryRunner.query(`ALTER TABLE "credit_transactions" DROP CONSTRAINT "FK_credit_transactions_account"`);
        await queryRunner.query(`DROP TABLE "credit_transactions"`);

        await queryRunner.query(`ALTER TABLE "credit_payments" DROP CONSTRAINT "FK_credit_payments_received_by"`);
        await queryRunner.query(`ALTER TABLE "credit_payments" DROP CONSTRAINT "FK_credit_payments_account"`);
        await queryRunner.query(`DROP TABLE "credit_payments"`);

        await queryRunner.query(`ALTER TABLE "credit_accounts" DROP CONSTRAINT "FK_credit_accounts_company"`);
        await queryRunner.query(`ALTER TABLE "credit_accounts" DROP CONSTRAINT "FK_credit_accounts_sale"`);
        await queryRunner.query(`ALTER TABLE "credit_accounts" DROP CONSTRAINT "FK_credit_accounts_customer"`);
        await queryRunner.query(`DROP TABLE "credit_accounts"`);
        await queryRunner.query(`DROP TYPE "public"."credit_accounts_status_enum"`);

        await queryRunner.query(`ALTER TABLE "inventory_transactions" DROP CONSTRAINT "FK_inventory_transactions_shop"`);
        await queryRunner.query(`ALTER TABLE "inventory_transactions" DROP CONSTRAINT "FK_inventory_transactions_warehouse"`);
        await queryRunner.query(`ALTER TABLE "inventory_transactions" DROP CONSTRAINT "FK_inventory_transactions_performed_by"`);
        await queryRunner.query(`ALTER TABLE "inventory_transactions" DROP CONSTRAINT "FK_inventory_transactions_product"`);
        await queryRunner.query(`DROP TABLE "inventory_transactions"`);
        await queryRunner.query(`DROP TYPE "public"."inventory_transactions_type_enum"`);
    }
}
