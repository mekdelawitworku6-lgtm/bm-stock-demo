import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPermissionsToEmployees1757000008000 implements MigrationInterface {
  name = 'AddPermissionsToEmployees1757000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
      ADD COLUMN IF NOT EXISTS "permissions" json
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "employees" DROP COLUMN IF EXISTS "permissions"`);
  }
}
