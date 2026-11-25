import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSupplierAndRemindersToProducts1757000000000 implements MigrationInterface {
    name = 'AddSupplierAndRemindersToProducts1757000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD "expiryReminderDays" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "products" ADD "lastLowStockAlertAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "products" ADD "lastExpiryReminderAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "products" ADD "supplierId" uuid`);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_products_supplier" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_products_supplier"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "supplierId"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "lastExpiryReminderAt"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "lastLowStockAlertAt"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "expiryReminderDays"`);
    }
}
