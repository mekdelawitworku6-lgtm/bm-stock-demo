import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReminderDateToProducts1757000001000 implements MigrationInterface {
    name = 'AddReminderDateToProducts1757000001000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD "reminderDate" date`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "expiryReminderDays"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD "expiryReminderDays" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "reminderDate"`);
    }
}
