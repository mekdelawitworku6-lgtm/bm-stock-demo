import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenSalesDiscountRate1788292854804 implements MigrationInterface {
  name = 'WidenSalesDiscountRate1788292854804';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales" ALTER COLUMN "discountRate" TYPE numeric(10,2) USING "discountRate"::numeric(10,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sales" ALTER COLUMN "discountRate" TYPE numeric(5,2) USING "discountRate"::numeric(5,2)`,
    );
  }
}