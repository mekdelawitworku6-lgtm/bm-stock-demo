import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmployeeAssignedCredentials1757000006000 implements MigrationInterface {
  name = 'AddEmployeeAssignedCredentials1757000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
      ADD COLUMN IF NOT EXISTS "assignedPassword" character varying(255),
      ADD COLUMN IF NOT EXISTS "assignedPin" character varying(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
      DROP COLUMN IF EXISTS "assignedPassword",
      DROP COLUMN IF EXISTS "assignedPin"
    `);
  }
}
