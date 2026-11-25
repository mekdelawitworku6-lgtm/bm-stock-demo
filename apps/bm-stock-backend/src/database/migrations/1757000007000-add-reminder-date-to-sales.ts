import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReminderDateToSales1757000007000 implements MigrationInterface {
  name = 'AddReminderDateToSales1757000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales" ADD "reminderDate" date`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "reminderDate"`);
  }
}
