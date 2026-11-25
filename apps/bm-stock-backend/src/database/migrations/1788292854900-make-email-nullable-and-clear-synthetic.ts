import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeEmailNullableAndClearSynthetic1788292854900 implements MigrationInterface {
  name = 'MakeEmailNullableAndClearSynthetic1788292854900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "UQ_97672ac88f789774dd47f7c8be3"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_97672ac88f789774dd47f7c8be"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email_unique" ON "users" ("email") WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(`
      UPDATE "users" 
      SET "email" = NULL 
      WHERE ("email" LIKE '%@bmstock.com' OR "email" LIKE '%@staff.bmstock.com' OR "email" LIKE '%@seed.bmstock.local');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email_unique"`);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email")`);
  }
}
