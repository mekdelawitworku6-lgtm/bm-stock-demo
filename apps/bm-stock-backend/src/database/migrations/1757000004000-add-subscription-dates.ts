import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionDates1757000004000 implements MigrationInterface {
  name = 'AddSubscriptionDates1757000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "subscriptionStartDate" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "subscriptionPaymentDate" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "subscriptionNextPaymentDate" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "subscriptionNextPaymentDate"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "subscriptionPaymentDate"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "subscriptionStartDate"`);
  }
}
