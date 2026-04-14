/**
 * Idempotent schema patches for existing databases (no manual phpMyAdmin import needed).
 * Uses CREATE TABLE IF NOT EXISTS + INSERT IGNORE — safe to run on every API startup.
 */
import { pool } from './db.js';
import { SIDEBAR_FEATURE_KEYS } from './accessConfig.js';

export async function ensureSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`branch\` (
      \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(160) NOT NULL,
      \`code\` VARCHAR(32) NULL DEFAULT NULL,
      \`ACTIVE\` TINYINT(1) NOT NULL DEFAULT 1,
      \`CREATED_DT\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_branch_code\` (\`code\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    INSERT IGNORE INTO \`branch\` (\`id\`, \`name\`, \`code\`, \`ACTIVE\`) VALUES
      (1, 'Main Office', 'BR001', 1),
      (2, 'North Annex', 'BR002', 1)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`role_sidebar_permissions\` (
      \`role_id\` INT UNSIGNED NOT NULL,
      \`feature_key\` VARCHAR(64) NOT NULL,
      PRIMARY KEY (\`role_id\`, \`feature_key\`),
      KEY \`idx_rsp_role\` (\`role_id\`),
      CONSTRAINT \`fk_rsp_user_role\` FOREIGN KEY (\`role_id\`) REFERENCES \`user_role\` (\`IDNo\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const values: string[] = [];
  for (let roleId = 1; roleId <= 5; roleId++) {
    for (const fk of SIDEBAR_FEATURE_KEYS) {
      values.push(`(${roleId}, '${fk}')`);
    }
  }
  await pool.query(
    `INSERT IGNORE INTO \`role_sidebar_permissions\` (\`role_id\`, \`feature_key\`) VALUES ${values.join(',')}`,
  );
}
