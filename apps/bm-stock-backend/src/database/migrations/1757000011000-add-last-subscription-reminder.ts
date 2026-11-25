import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastSubscriptionReminder1757000011000 implements MigrationInterface {
  name = 'AddLastSubscriptionReminder1757000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "lastSubscriptionReminderAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastSubscriptionReminderAt"`);
  }
}
