/**
 * Idempotent schema patches for existing databases (no manual phpMyAdmin import needed).
 * Uses CREATE TABLE IF NOT EXISTS + INSERT IGNORE — safe to run on every API startup.
 */
import { pool } from './config/db.js';
import { SIDEBAR_FEATURE_KEYS } from './accessConfig.js';

export async function ensureSchema() {
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

  const values = [];
  for (let roleId = 1; roleId <= 5; roleId++) {
    for (const fk of SIDEBAR_FEATURE_KEYS) {
      values.push(`(${roleId}, '${fk}')`);
    }
  }
  await pool.query(
    `INSERT IGNORE INTO \`role_sidebar_permissions\` (\`role_id\`, \`feature_key\`) VALUES ${values.join(',')}`,
  );

  // Shared contract table (used by contracts + payments). Kept outside legacy mode.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`lease_contract\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`unit_id\` BIGINT UNSIGNED NOT NULL,
      \`tenant_id\` BIGINT UNSIGNED NOT NULL,
      \`agent_id\` INT UNSIGNED NOT NULL,
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
      KEY \`idx_lease_contract_agent\` (\`agent_id\`),
      CONSTRAINT \`fk_lease_contract_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_lease_contract_unit\` FOREIGN KEY (\`unit_id\`) REFERENCES \`unit\` (\`id\`),
      CONSTRAINT \`fk_lease_contract_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant_profile\` (\`id\`),
      CONSTRAINT \`fk_lease_contract_agent\` FOREIGN KEY (\`agent_id\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  if (process.env.LEGACY_SCHEMA === '1') {
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

  const [countRows] = await pool.query('SELECT COUNT(*) AS n FROM property_unit');
  const n = Number(countRows[0]?.n ?? 0);
  if (n === 0) {
    const invU1 = JSON.stringify([
      { id: 'i1', name: 'Refrigerator', condition: 'Good', quantity: 1 },
      { id: 'i2', name: 'Aircon', condition: 'New', quantity: 1 },
    ]);
    const seeds = [
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

  const [tenantCountRows] = await pool.query('SELECT COUNT(*) AS n FROM crm_tenant');
  const tn = Number(tenantCountRows[0]?.n ?? 0);
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

  const [contractCountRows] = await pool.query('SELECT COUNT(*) AS n FROM lease_contract');
  const cn = Number(contractCountRows[0]?.n ?? 0);
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

  const [paymentCountRows] = await pool.query('SELECT COUNT(*) AS n FROM payment_collection');
  const pn = Number(paymentCountRows[0]?.n ?? 0);
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`area\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`name\` VARCHAR(120) NOT NULL,
      \`city\` VARCHAR(120) NULL DEFAULT NULL,
      \`district\` VARCHAR(120) NULL DEFAULT NULL,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_area_branch_name\` (\`branch_id\`, \`name\`),
      KEY \`idx_area_city\` (\`city\`),
      CONSTRAINT \`fk_area_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`property\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`area_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`property_code\` VARCHAR(40) NULL DEFAULT NULL,
      \`name\` VARCHAR(180) NOT NULL,
      \`common_address\` VARCHAR(255) NOT NULL,
      \`legal_address\` VARCHAR(255) NOT NULL,
      \`property_type\` ENUM('condo','house','commercial','mixed_use','other') NOT NULL DEFAULT 'condo',
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_property_code\` (\`property_code\`),
      KEY \`idx_property_branch_area\` (\`branch_id\`, \`area_id\`),
      CONSTRAINT \`fk_property_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_property_area\` FOREIGN KEY (\`area_id\`) REFERENCES \`area\` (\`id\`),
      CONSTRAINT \`fk_property_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`unit\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`property_id\` BIGINT UNSIGNED NOT NULL,
      \`unit_code\` VARCHAR(60) NOT NULL,
      \`building_no\` VARCHAR(40) NULL DEFAULT NULL,
      \`tower\` VARCHAR(80) NULL DEFAULT NULL,
      \`floor_no\` VARCHAR(20) NULL DEFAULT NULL,
      \`unit_no\` VARCHAR(40) NOT NULL,
      \`unit_type\` VARCHAR(40) NOT NULL,
      \`listing_type\` ENUM('monthly_rental','selling','short_term_rental') NOT NULL DEFAULT 'monthly_rental',
      \`monthly_rent\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      \`market_value\` DECIMAL(14,2) NULL DEFAULT NULL,
      \`status\` ENUM('vacant','occupied','reserved','maintenance','inactive') NOT NULL DEFAULT 'vacant',
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_unit_property_unit_code\` (\`property_id\`, \`unit_code\`),
      KEY \`idx_unit_status\` (\`status\`),
      KEY \`idx_unit_listing_type\` (\`listing_type\`),
      CONSTRAINT \`fk_unit_property\` FOREIGN KEY (\`property_id\`) REFERENCES \`property\` (\`id\`),
      CONSTRAINT \`fk_unit_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Compatibility column used by the current API (unitsController expects inventory_json).
  try {
    await pool.query(`ALTER TABLE \`unit\` ADD COLUMN \`inventory_json\` LONGTEXT NULL`);
  } catch (e) {
    // Ignore "Duplicate column name" so schema bootstrapping stays idempotent.
    if (!String(e?.message ?? '').toLowerCase().includes('duplicate column')) {
      throw e;
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`partner_agency\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`agency_name\` VARCHAR(180) NOT NULL,
      \`contact_person\` VARCHAR(140) NULL DEFAULT NULL,
      \`contact_number\` VARCHAR(40) NULL DEFAULT NULL,
      \`email\` VARCHAR(180) NULL DEFAULT NULL,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_partner_agency_branch_name\` (\`branch_id\`, \`agency_name\`),
      KEY \`idx_partner_agency_branch\` (\`branch_id\`),
      CONSTRAINT \`fk_partner_agency_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`landlord_profile\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`full_name\` VARCHAR(180) NOT NULL,
      \`mobile_no\` VARCHAR(40) NULL DEFAULT NULL,
      \`email\` VARCHAR(180) NULL DEFAULT NULL,
      \`gov_id_no\` VARCHAR(100) NULL DEFAULT NULL,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_landlord_name\` (\`full_name\`),
      KEY \`idx_landlord_branch\` (\`branch_id\`),
      CONSTRAINT \`fk_landlord_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`tenant_profile\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`full_name\` VARCHAR(180) NOT NULL,
      \`email\` VARCHAR(180) NULL DEFAULT NULL,
      \`mobile_no\` VARCHAR(40) NULL DEFAULT NULL,
      \`nationality\` VARCHAR(80) NULL DEFAULT NULL,
      \`passport_no\` VARCHAR(100) NULL DEFAULT NULL,
      \`primary_id_no\` VARCHAR(100) NULL DEFAULT NULL,
      \`birth_date\` DATE NULL DEFAULT NULL,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_tenant_name\` (\`full_name\`),
      KEY \`idx_tenant_branch\` (\`branch_id\`),
      CONSTRAINT \`fk_tenant_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Compatibility columns used by the current API (tenantsController expects KYC + blacklist fields).
  // If you later want full normalization, we can move these to `tenant_document` + `blacklist_record`.
  try {
    await pool.query(`ALTER TABLE \`tenant_profile\` ADD COLUMN \`id_type\` VARCHAR(64) NOT NULL DEFAULT ''`);
  } catch (e) {
    if (!String(e?.message ?? '').toLowerCase().includes('duplicate column')) throw e;
  }
  try {
    await pool.query(`ALTER TABLE \`tenant_profile\` ADD COLUMN \`id_number\` VARCHAR(128) NOT NULL DEFAULT ''`);
  } catch (e) {
    if (!String(e?.message ?? '').toLowerCase().includes('duplicate column')) throw e;
  }
  try {
    await pool.query(`ALTER TABLE \`tenant_profile\` ADD COLUMN \`id_expiry\` DATE NULL DEFAULT NULL`);
  } catch (e) {
    if (!String(e?.message ?? '').toLowerCase().includes('duplicate column')) throw e;
  }
  try {
    await pool.query(`ALTER TABLE \`tenant_profile\` ADD COLUMN \`id_image_url\` VARCHAR(500) NULL DEFAULT NULL`);
  } catch (e) {
    if (!String(e?.message ?? '').toLowerCase().includes('duplicate column')) throw e;
  }
  try {
    await pool.query(`ALTER TABLE \`tenant_profile\` ADD COLUMN \`kyc_verified\` TINYINT(1) NOT NULL DEFAULT 1`);
  } catch (e) {
    if (!String(e?.message ?? '').toLowerCase().includes('duplicate column')) throw e;
  }
  try {
    await pool.query(`ALTER TABLE \`tenant_profile\` ADD COLUMN \`is_blacklisted\` TINYINT(1) NOT NULL DEFAULT 0`);
  } catch (e) {
    if (!String(e?.message ?? '').toLowerCase().includes('duplicate column')) throw e;
  }
  try {
    await pool.query(`ALTER TABLE \`tenant_profile\` ADD COLUMN \`blacklist_reason\` VARCHAR(500) NULL DEFAULT NULL`);
  } catch (e) {
    if (!String(e?.message ?? '').toLowerCase().includes('duplicate column')) throw e;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`contract_tenant\` (
      \`contract_id\` BIGINT UNSIGNED NOT NULL,
      \`tenant_id\` BIGINT UNSIGNED NOT NULL,
      \`is_primary\` TINYINT(1) NOT NULL DEFAULT 0,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`contract_id\`, \`tenant_id\`),
      KEY \`idx_contract_tenant_tenant\` (\`tenant_id\`),
      CONSTRAINT \`fk_ct_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_ct_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant_profile\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`blacklist_record\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`entity_type\` ENUM('tenant','landlord') NOT NULL,
      \`tenant_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`landlord_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`reason\` VARCHAR(255) NOT NULL,
      \`details\` TEXT NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`tagged_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`tagged_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_blacklist_branch\` (\`branch_id\`),
      KEY \`idx_blacklist_entity\` (\`entity_type\`, \`is_active\`),
      CONSTRAINT \`fk_blacklist_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_blacklist_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant_profile\` (\`id\`),
      CONSTRAINT \`fk_blacklist_landlord\` FOREIGN KEY (\`landlord_id\`) REFERENCES \`landlord_profile\` (\`id\`),
      CONSTRAINT \`fk_blacklist_tagged_by\` FOREIGN KEY (\`tagged_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`document_template\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`template_key\` VARCHAR(80) NOT NULL,
      \`title\` VARCHAR(180) NOT NULL,
      \`file_path\` VARCHAR(255) NOT NULL,
      \`version_no\` INT UNSIGNED NOT NULL DEFAULT 1,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_doc_template_branch_key_version\` (\`branch_id\`, \`template_key\`, \`version_no\`),
      KEY \`idx_doc_template_branch\` (\`branch_id\`),
      CONSTRAINT \`fk_doc_template_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_doc_template_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`document_repository\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`contract_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`tenant_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`uploaded_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`doc_type\` ENUM('lease_contract','invoice','kyc','receipt','move_in_out','other') NOT NULL DEFAULT 'other',
      \`title\` VARCHAR(180) NOT NULL,
      \`file_path\` VARCHAR(255) NOT NULL,
      \`is_portal_visible\` TINYINT(1) NOT NULL DEFAULT 0,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_doc_repo_branch\` (\`branch_id\`),
      KEY \`idx_doc_repo_contract\` (\`contract_id\`),
      KEY \`idx_doc_repo_tenant\` (\`tenant_id\`),
      KEY \`idx_doc_repo_doc_type\` (\`doc_type\`),
      CONSTRAINT \`fk_doc_repo_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_doc_repo_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_doc_repo_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant_profile\` (\`id\`),
      CONSTRAINT \`fk_doc_repo_uploaded_by\` FOREIGN KEY (\`uploaded_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`tenant_document\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`tenant_id\` BIGINT UNSIGNED NOT NULL,
      \`document_type\` ENUM('passport','national_id','visa','contract_attachment','other') NOT NULL DEFAULT 'other',
      \`document_no\` VARCHAR(120) NULL DEFAULT NULL,
      \`expiry_date\` DATE NULL DEFAULT NULL,
      \`file_path\` VARCHAR(255) NOT NULL,
      \`verified_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`verified_at\` DATETIME NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_tenant_document_branch\` (\`branch_id\`),
      KEY \`idx_tenant_document_tenant\` (\`tenant_id\`),
      CONSTRAINT \`fk_tenant_document_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_tenant_document_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant_profile\` (\`id\`),
      CONSTRAINT \`fk_tenant_document_verified_by\` FOREIGN KEY (\`verified_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`invoice\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`invoice_no\` VARCHAR(60) NOT NULL,
      \`contract_id\` BIGINT UNSIGNED NOT NULL,
      \`billing_period_start\` DATE NOT NULL,
      \`billing_period_end\` DATE NOT NULL,
      \`due_date\` DATE NOT NULL,
      \`base_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      \`other_charges\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      \`discount_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      \`total_amount\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      \`status\` ENUM('draft','issued','partially_paid','paid','overdue','void') NOT NULL DEFAULT 'draft',
      \`issued_at\` DATETIME NULL DEFAULT NULL,
      \`created_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_invoice_no\` (\`invoice_no\`),
      KEY \`idx_invoice_branch\` (\`branch_id\`),
      KEY \`idx_invoice_contract_status\` (\`contract_id\`, \`status\`),
      KEY \`idx_invoice_due_date\` (\`due_date\`),
      CONSTRAINT \`fk_invoice_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_invoice_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_invoice_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`payment_schedule\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`contract_id\` BIGINT UNSIGNED NOT NULL,
      \`invoice_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`due_date\` DATE NOT NULL,
      \`amount_due\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      \`status\` ENUM('pending','partially_paid','paid','overdue','waived') NOT NULL DEFAULT 'pending',
      \`notes\` VARCHAR(255) NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_payment_schedule_branch\` (\`branch_id\`),
      KEY \`idx_payment_schedule_contract_due\` (\`contract_id\`, \`due_date\`),
      KEY \`idx_payment_schedule_status_due\` (\`status\`, \`due_date\`),
      CONSTRAINT \`fk_payment_schedule_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_payment_schedule_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_payment_schedule_invoice\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoice\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`payment_transaction\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`payment_schedule_id\` BIGINT UNSIGNED NOT NULL,
      \`invoice_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`amount_paid\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      \`payment_date\` DATE NOT NULL,
      \`payment_method\` ENUM('cash','bank_transfer','online','check','other') NOT NULL DEFAULT 'cash',
      \`reference_no\` VARCHAR(100) NULL DEFAULT NULL,
      \`received_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`remarks\` VARCHAR(255) NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_payment_txn_branch\` (\`branch_id\`),
      KEY \`idx_payment_txn_date\` (\`payment_date\`),
      KEY \`idx_payment_txn_schedule\` (\`payment_schedule_id\`),
      CONSTRAINT \`fk_payment_txn_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_payment_txn_schedule\` FOREIGN KEY (\`payment_schedule_id\`) REFERENCES \`payment_schedule\` (\`id\`),
      CONSTRAINT \`fk_payment_txn_invoice\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoice\` (\`id\`),
      CONSTRAINT \`fk_payment_txn_received_by\` FOREIGN KEY (\`received_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`contract_collaboration\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`contract_id\` BIGINT UNSIGNED NOT NULL,
      \`partner_agency_id\` BIGINT UNSIGNED NOT NULL,
      \`commission_terms\` VARCHAR(255) NULL DEFAULT NULL,
      \`remarks\` TEXT NULL,
      \`created_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_collab_branch\` (\`branch_id\`),
      KEY \`idx_collab_contract\` (\`contract_id\`),
      CONSTRAINT \`fk_collab_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_collab_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_collab_agency\` FOREIGN KEY (\`partner_agency_id\`) REFERENCES \`partner_agency\` (\`id\`),
      CONSTRAINT \`fk_collab_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`special_request\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`contract_id\` BIGINT UNSIGNED NOT NULL,
      \`request_source\` ENUM('tenant','landlord','internal') NOT NULL DEFAULT 'tenant',
      \`title\` VARCHAR(180) NOT NULL,
      \`details\` TEXT NOT NULL,
      \`status\` ENUM('open','in_progress','resolved','cancelled') NOT NULL DEFAULT 'open',
      \`created_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_special_request_branch\` (\`branch_id\`),
      KEY \`idx_special_request_contract_status\` (\`contract_id\`, \`status\`),
      CONSTRAINT \`fk_special_request_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_special_request_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_special_request_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`inventory_snapshot\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`contract_id\` BIGINT UNSIGNED NOT NULL,
      \`snapshot_type\` ENUM('move_in','move_out','routine') NOT NULL DEFAULT 'move_in',
      \`inspection_date\` DATE NOT NULL,
      \`inspected_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`remarks\` TEXT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_inventory_snapshot_branch\` (\`branch_id\`),
      KEY \`idx_inventory_snapshot_contract_type\` (\`contract_id\`, \`snapshot_type\`),
      CONSTRAINT \`fk_inventory_snapshot_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_inventory_snapshot_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_inventory_snapshot_inspected_by\` FOREIGN KEY (\`inspected_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`inventory_snapshot_item\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`snapshot_id\` BIGINT UNSIGNED NOT NULL,
      \`item_name\` VARCHAR(180) NOT NULL,
      \`category\` VARCHAR(80) NULL DEFAULT NULL,
      \`quantity\` INT UNSIGNED NOT NULL DEFAULT 1,
      \`condition_state\` ENUM('excellent','good','fair','damaged','missing') NOT NULL DEFAULT 'good',
      \`notes\` VARCHAR(255) NULL DEFAULT NULL,
      PRIMARY KEY (\`id\`),
      KEY \`idx_inventory_item_snapshot\` (\`snapshot_id\`),
      CONSTRAINT \`fk_inventory_item_snapshot\` FOREIGN KEY (\`snapshot_id\`) REFERENCES \`inventory_snapshot\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`calendar_event\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`contract_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`payment_schedule_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`event_type\` ENUM('move_in','move_out','payment_due','payment_received','inspection','other') NOT NULL,
      \`event_date\` DATE NOT NULL,
      \`title\` VARCHAR(180) NOT NULL,
      \`color_code\` VARCHAR(20) NULL DEFAULT NULL,
      \`metadata_json\` JSON NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_calendar_event_branch\` (\`branch_id\`),
      KEY \`idx_calendar_event_date_type\` (\`event_date\`, \`event_type\`),
      CONSTRAINT \`fk_calendar_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_calendar_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_calendar_payment_schedule\` FOREIGN KEY (\`payment_schedule_id\`) REFERENCES \`payment_schedule\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`audit_log\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`actor_user_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`module_name\` VARCHAR(80) NOT NULL,
      \`record_table\` VARCHAR(80) NOT NULL,
      \`record_id\` VARCHAR(80) NULL DEFAULT NULL,
      \`action\` ENUM('create','update','delete','status_change','override','login') NOT NULL,
      \`change_summary\` TEXT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_audit_branch\` (\`branch_id\`),
      KEY \`idx_audit_module_date\` (\`module_name\`, \`created_at\`),
      CONSTRAINT \`fk_audit_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_audit_actor_user\` FOREIGN KEY (\`actor_user_id\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}
