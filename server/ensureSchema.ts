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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`crm_tenant\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`name\` VARCHAR(200) NOT NULL,
      \`email\` VARCHAR(255) NOT NULL DEFAULT '',
      \`phone\` VARCHAR(64) NOT NULL DEFAULT '',
      \`id_type\` VARCHAR(64) NOT NULL DEFAULT '',
      \`id_number\` VARCHAR(128) NOT NULL DEFAULT '',
      \`id_expiry\` DATE NULL,
      \`id_image_url\` VARCHAR(500) NULL DEFAULT NULL,
      \`kyc_verified\` TINYINT(1) NOT NULL DEFAULT 1,
      \`is_blacklisted\` TINYINT(1) NOT NULL DEFAULT 0,
      \`blacklist_reason\` VARCHAR(500) NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_crm_tenant_branch\` (\`branch_id\`),
      CONSTRAINT \`fk_crm_tenant_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [tenantCountRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM crm_tenant');
  const tn = Number((tenantCountRows as RowDataPacket[])[0]?.n ?? 0);
  if (tn === 0) {
    await pool.query(
      `INSERT INTO crm_tenant (
        id, branch_id, name, email, phone, id_type, id_number, id_expiry,
        kyc_verified, is_blacklisted, blacklist_reason
      ) VALUES
        ('t1', 1, 'Michael Chen', 'michael@example.com', '+63 917 555 0101', 'Passport', 'P1234567A', '2028-12-31', 1, 0, NULL),
        ('t2', 1, 'Sarah Johnson', 'sarah@example.com', '+63 918 555 0202', 'UMID', '1234-5678901-2', '2030-01-01', 1, 0, NULL)`,
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`lease_contract\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`unit_id\` VARCHAR(36) NOT NULL,
      \`tenant_id\` VARCHAR(36) NOT NULL,
      \`agent_id\` VARCHAR(64) NOT NULL,
      \`start_date\` DATE NOT NULL,
      \`end_date\` DATE NOT NULL,
      \`monthly_rent\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`security_deposit\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`advance_rent\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`contract_type\` VARCHAR(64) NOT NULL DEFAULT 'Monthly Rental',
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'Active',
      \`remarks\` VARCHAR(500) NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_lease_contract_branch\` (\`branch_id\`),
      KEY \`idx_lease_contract_tenant\` (\`tenant_id\`),
      KEY \`idx_lease_contract_unit\` (\`unit_id\`),
      CONSTRAINT \`fk_lease_contract_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [contractCountRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM lease_contract');
  const cn = Number((contractCountRows as RowDataPacket[])[0]?.n ?? 0);
  if (cn === 0) {
    await pool.query(
      `INSERT INTO lease_contract (
        id, branch_id, unit_id, tenant_id, agent_id, start_date, end_date, monthly_rent,
        security_deposit, advance_rent, contract_type, status, remarks
      ) VALUES
        ('c1', 1, 'u1', 't1', 'a1', CURDATE() - INTERVAL 180 DAY, CURDATE() + INTERVAL 25 DAY, 35000, 70000, 35000, 'Monthly Rental', 'Active', 'Foreign tenant, requires monthly receipt.'),
        ('c2', 1, 'u3', 't2', 'a2', CURDATE() - INTERVAL 300 DAY, CURDATE() + INTERVAL 45 DAY, 28000, 56000, 28000, 'Monthly Rental', 'Active', NULL),
        ('c3', 1, 'u4', 't1', 'a3', CURDATE() - INTERVAL 15 DAY, CURDATE() + INTERVAL 350 DAY, 45000, 90000, 45000, 'Monthly Rental', 'Active', NULL)`,
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`payment_collection\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`contract_id\` VARCHAR(36) NOT NULL,
      \`unit_id\` VARCHAR(36) NOT NULL,
      \`amount\` DECIMAL(14,2) NOT NULL DEFAULT 0,
      \`due_date\` DATE NOT NULL,
      \`paid_date\` DATE NULL,
      \`status\` VARCHAR(32) NOT NULL DEFAULT 'Pending',
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_payment_collection_branch\` (\`branch_id\`),
      KEY \`idx_payment_collection_contract\` (\`contract_id\`),
      KEY \`idx_payment_collection_unit\` (\`unit_id\`),
      CONSTRAINT \`fk_payment_collection_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [paymentCountRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM payment_collection');
  const pn = Number((paymentCountRows as RowDataPacket[])[0]?.n ?? 0);
  if (pn === 0) {
    await pool.query(
      `INSERT INTO payment_collection (
        id, branch_id, contract_id, unit_id, amount, due_date, paid_date, status
      ) VALUES
        ('p1', 1, 'c1', 'u1', 35000, DATE_FORMAT(CURDATE(), '%Y-%m-01'), DATE_FORMAT(CURDATE(), '%Y-%m-01'), 'Paid'),
        ('p2', 1, 'c2', 'u3', 28000, CURDATE() - INTERVAL 5 DAY, NULL, 'Overdue'),
        ('p3', 1, 'c3', 'u4', 45000, CURDATE() + INTERVAL 3 DAY, NULL, 'Pending')`,
    );
  }
}
