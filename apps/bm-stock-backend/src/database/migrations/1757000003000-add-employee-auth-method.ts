import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeeAuthMethod1757000003000 implements MigrationInterface {
  name = 'AddEmployeeAuthMethod1757000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "employees" ADD "authMethod" character varying(20) NOT NULL DEFAULT 'password'`,
    );
    await queryRunner.query(`ALTER TABLE "employees" ADD "pin" character varying(255)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "pin"`);
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN "authMethod"`);
  }
}
