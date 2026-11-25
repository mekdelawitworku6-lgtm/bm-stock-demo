import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyStatusAndUserFaydaTin1757000005000 implements MigrationInterface {
  name = 'AddCompanyStatusAndUserFaydaTin1757000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."companies_status_enum" AS ENUM('active', 'deactivated', 'subscription_expired')`,
    );
    await queryRunner.query(
      `ALTER TABLE "companies" ADD "status" "public"."companies_status_enum" NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "faydaId" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "users" ADD "tin" character varying(20)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "tin"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "faydaId"`);
    await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."companies_status_enum"`);
  }
}
