import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReceiptImageUrlToSales1757000002000 implements MigrationInterface {
    name = 'AddReceiptImageUrlToSales1757000002000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sales" ADD "receiptImageUrl" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "receiptImageUrl"`);
    }
}
