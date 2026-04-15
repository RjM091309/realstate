/**
 * Idempotent schema patches for existing databases (no manual phpMyAdmin import needed).
 * Uses CREATE TABLE IF NOT EXISTS + INSERT IGNORE — safe to run on every API startup.
 */
import type { RowDataPacket } from 'mysql2';
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`property_unit\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`unit_number\` VARCHAR(64) NOT NULL,
      \`floor\` VARCHAR(64) NOT NULL DEFAULT '',
      \`tower\` VARCHAR(128) NOT NULL DEFAULT '',
      \`building_name\` VARCHAR(200) NOT NULL,
      \`common_address\` VARCHAR(500) NOT NULL DEFAULT '',
      \`legal_address\` VARCHAR(1000) NOT NULL DEFAULT '',
      \`unit_type\` VARCHAR(32) NOT NULL,
      \`status\` VARCHAR(32) NOT NULL,
      \`area\` VARCHAR(64) NOT NULL,
      \`monthly_rate\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`inventory_json\` LONGTEXT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_property_unit_branch\` (\`branch_id\`),
      CONSTRAINT \`fk_property_unit_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [countRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM property_unit');
  const n = Number((countRows as RowDataPacket[])[0]?.n ?? 0);
  if (n === 0) {
    const invU1 = JSON.stringify([
      { id: 'i1', name: 'Refrigerator', condition: 'Good', quantity: 1 },
      { id: 'i2', name: 'Aircon', condition: 'New', quantity: 1 },
    ]);
    const seeds: [string, number, string, string, string, string, string, string, string, string, string, number, string][] = [
      ['u1', 1, '1201', '12', 'Tower A', 'The Rise', 'The Rise Makati', '7248 Malugay St, Makati, 1203 Metro Manila', '1BR', 'Occupied', 'Makati', 35000, invU1],
      ['u2', 1, '2505', '25', 'West Tower', 'One Serendra', 'One Serendra BGC', '11th Ave, Taguig, Metro Manila', '2BR', 'Available', 'BGC', 85000, '[]'],
      ['u3', 1, '808', '8', 'South Wing', 'Park Terraces', 'Park Terraces Makati', 'Arnaiz Ave, Makati, Metro Manila', 'Studio', 'Occupied', 'Makati', 28000, '[]'],
      ['u4', 1, '1510', '15', 'Tower 1', 'The Sapphire Bloc', 'Sapphire Bloc Pasig', 'Sapphire Road, Ortigas Center, Pasig', 'Loft', 'Occupied', 'Pasig', 45000, '[]'],
      ['u5', 1, '302', '3', 'North Tower', 'Avida Towers', 'Avida BGC', '9th Ave, Taguig, Metro Manila', '1BR', 'Available', 'BGC', 32000, '[]'],
    ];
    for (const s of seeds) {
      await pool.query(
        `INSERT INTO property_unit (
          id, branch_id, unit_number, floor, tower, building_name, common_address, legal_address,
          unit_type, status, area, monthly_rate, inventory_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s,
      );
    }
  }
}
