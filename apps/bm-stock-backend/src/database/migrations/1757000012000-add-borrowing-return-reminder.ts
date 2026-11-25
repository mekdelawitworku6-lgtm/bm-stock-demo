import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBorrowingReturnReminder1757000012000 implements MigrationInterface {
  name = 'AddBorrowingReturnReminder1757000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'borrowing'`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_borrowings" ADD "lastReturnReminderAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_borrowings" DROP COLUMN "lastReturnReminderAt"`,
    );
    await queryRunner.query(
      `DELETE FROM "pg_enum" WHERE "enumlabel" = 'borrowing' AND "enumtypid" = 'notifications_type_enum'::regtype`,
    );
  }
}