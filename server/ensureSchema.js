/**
 * Idempotent schema patches for existing databases (no manual phpMyAdmin import needed).
 * Uses CREATE TABLE IF NOT EXISTS + INSERT IGNORE — safe to run on every API startup.
 */
import { pool } from './config/db.js';
import { SIDEBAR_FEATURE_KEYS } from './accessConfig.js';

/**
 * notification_feed is a VIEW; notification_read is a real table.
 * Safe to run on every startup (CREATE TABLE IF NOT EXISTS + CREATE OR REPLACE VIEW).
 * Also invoked from index.js so this still runs if ensureSchema() aborts mid-way.
 */
export async function ensureNotificationSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`notification_read\` (
      \`user_id\` INT UNSIGNED NOT NULL,
      \`notification_key\` VARCHAR(120) NOT NULL,
      \`read_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`user_id\`, \`notification_key\`),
      KEY \`idx_notification_read_user\` (\`user_id\`),
      CONSTRAINT \`fk_notification_read_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`user_info\` (\`IDNO\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE OR REPLACE VIEW \`notification_feed\` AS
      SELECT
        CONCAT('payment_txn:', pt.id) AS notification_key,
        pt.branch_id AS branch_id,
        pt.id AS source_id,
        'payment_transaction' AS source_table,
        pt.created_at AS created_at,
        'payment' AS type,
        'Rent payment received' AS title,
        CONCAT(
          'Payment of ',
          FORMAT(pt.amount_paid, 2),
          ' was posted for ',
          COALESCE(tp.full_name, 'tenant'),
          ' (',
          COALESCE(p.name, 'property'),
          ' ',
          COALESCE(u.unit_no, u.unit_code),
          ').'
        ) AS message
      FROM payment_transaction pt
      JOIN payment_schedule ps ON ps.id = pt.payment_schedule_id AND ps.branch_id = pt.branch_id AND ps.active = 1
      JOIN lease_contract lc ON lc.id = ps.contract_id AND lc.branch_id = ps.branch_id AND lc.active = 1
      JOIN unit u ON u.id = lc.unit_id AND u.active = 1
      JOIN property p ON p.id = u.property_id AND p.active = 1
      LEFT JOIN contract_tenant ct ON ct.contract_id = lc.id AND ct.active = 1 AND ct.is_primary = 1
      LEFT JOIN tenant_profile tp ON tp.id = ct.tenant_id AND tp.active = 1
      WHERE pt.active = 1

      UNION ALL

      SELECT
        CONCAT('payment_due:', ps.id) AS notification_key,
        ps.branch_id AS branch_id,
        ps.id AS source_id,
        'payment_schedule' AS source_table,
        ps.created_at AS created_at,
        'payment' AS type,
        CASE ps.status
          WHEN 'overdue' THEN 'Rent payment overdue'
          ELSE 'Upcoming rent payment'
        END AS title,
        CONCAT(
          'Due on ',
          DATE_FORMAT(ps.due_date, '%Y-%m-%d'),
          ': ',
          FORMAT(ps.amount_due, 2),
          ' for ',
          COALESCE(tp.full_name, 'tenant'),
          ' (',
          COALESCE(p.name, 'property'),
          ' ',
          COALESCE(u.unit_no, u.unit_code),
          ').'
        ) AS message
      FROM payment_schedule ps
      JOIN lease_contract lc ON lc.id = ps.contract_id AND lc.branch_id = ps.branch_id AND lc.active = 1
      JOIN unit u ON u.id = lc.unit_id AND u.active = 1
      JOIN property p ON p.id = u.property_id AND p.active = 1
      LEFT JOIN contract_tenant ct ON ct.contract_id = lc.id AND ct.active = 1 AND ct.is_primary = 1
      LEFT JOIN tenant_profile tp ON tp.id = ct.tenant_id AND tp.active = 1
      WHERE ps.active = 1 AND ps.status IN ('pending', 'overdue')

      UNION ALL

      SELECT
        CONCAT('maintenance:', sr.id) AS notification_key,
        sr.branch_id AS branch_id,
        sr.id AS source_id,
        'special_request' AS source_table,
        sr.created_at AS created_at,
        'maintenance' AS type,
        'Maintenance ticket opened' AS title,
        CONCAT(
          COALESCE(NULLIF(TRIM(sr.title), ''), 'Maintenance request'),
          ' — ',
          LEFT(COALESCE(NULLIF(TRIM(sr.details), ''), ''), 160),
          CASE WHEN CHAR_LENGTH(COALESCE(NULLIF(TRIM(sr.details), ''), '')) > 160 THEN '…' ELSE '' END
        ) AS message
      FROM special_request sr
      JOIN lease_contract lc ON lc.id = sr.contract_id AND lc.branch_id = sr.branch_id AND lc.active = 1
      WHERE sr.status IN ('open', 'in_progress')

      UNION ALL

      SELECT
        CONCAT('lease:', lc.id, ':', lc.status) AS notification_key,
        lc.branch_id AS branch_id,
        lc.id AS source_id,
        'lease_contract' AS source_table,
        COALESCE(lc.updated_at, lc.created_at) AS created_at,
        CASE lc.status
          WHEN 'active' THEN 'success'
          ELSE 'lease'
        END AS type,
        CASE lc.status
          WHEN 'active' THEN 'Lease activated'
          WHEN 'terminated' THEN 'Lease terminated'
          WHEN 'cancelled' THEN 'Lease cancelled'
          ELSE 'Lease updated'
        END AS title,
        CONCAT(
          'Contract ',
          lc.contract_no,
          ' status: ',
          lc.status
        ) AS message
      FROM lease_contract lc
      WHERE lc.active = 1 AND lc.status IN ('active', 'terminated', 'cancelled')
  `);
}

/** One-time copy of active legacy blacklist_record rows into the new blacklist table. */
async function migrateLegacyBlacklistRecords() {
  const [[countRow]] = await pool.query(`SELECT COUNT(*) AS cnt FROM \`blacklist\``);
  if (Number(countRow?.cnt ?? 0) > 0) return;

  const [[legacyRow]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM \`blacklist_record\` WHERE is_active = 1 AND entity_type IN ('tenant','broker')`,
  );
  if (Number(legacyRow?.cnt ?? 0) === 0) return;

  await pool.query(`
    INSERT INTO \`blacklist\` (
      branch_id,
      entity_type,
      name,
      email,
      phone,
      government_id,
      reason,
      blacklisted_by,
      tenant_id,
      partner_agency_id,
      is_active,
      created_at,
      updated_at
    )
    SELECT
      b.branch_id,
      b.entity_type,
      COALESCE(
        NULLIF(TRIM(tp.full_name), ''),
        NULLIF(TRIM(pa.agency_name), ''),
        '—'
      ) AS name,
      COALESCE(NULLIF(TRIM(tp.email), ''), NULLIF(TRIM(pa.email), '')) AS email,
      COALESCE(NULLIF(TRIM(tp.mobile_no), ''), NULLIF(TRIM(pa.contact_number), '')) AS phone,
      COALESCE(NULLIF(TRIM(td.document_no), ''), NULLIF(TRIM(pa.document_no), '')) AS government_id,
      b.reason,
      b.tagged_by,
      b.tenant_id,
      b.partner_agency_id,
      b.is_active,
      b.tagged_at,
      b.tagged_at
    FROM blacklist_record b
    LEFT JOIN tenant_profile tp ON tp.id = b.tenant_id
    LEFT JOIN partner_agency pa ON pa.id = b.partner_agency_id
    LEFT JOIN tenant_document td ON td.id = (
      SELECT MAX(td2.id)
      FROM tenant_document td2
      WHERE td2.tenant_id = b.tenant_id
        AND td2.document_type IN ('passport', 'national_id', 'visa')
    )
    WHERE b.is_active = 1 AND b.entity_type IN ('tenant', 'broker')
  `);
}

export async function ensureSchema() {
  async function ensurePartnerAgencyDocColumns() {
    async function addColumnIfMissing(sql) {
      try {
        await pool.query(sql);
      } catch (error) {
        // Concurrent API boots can race on ALTER TABLE; ignore duplicate-column in that case.
        if (error?.code !== 'ER_DUP_FIELDNAME') throw error;
      }
    }

    const [rows] = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'partner_agency'
        AND column_name IN ('nationality', 'document_type', 'document_no', 'expiry_date', 'file_path')
      `,
    );
    const existing = new Set(rows.map((r) => String(r.column_name)));

    // Keep each ALTER separate so one failure doesn't block others.
    if (!existing.has('nationality')) {
      await addColumnIfMissing(
        `ALTER TABLE \`partner_agency\` ADD COLUMN \`nationality\` CHAR(3) NULL DEFAULT NULL`,
      );
    }
    if (!existing.has('document_type')) {
      await addColumnIfMissing(
        `ALTER TABLE \`partner_agency\` ADD COLUMN \`document_type\` VARCHAR(60) NULL DEFAULT NULL`,
      );
    }
    if (!existing.has('document_no')) {
      await addColumnIfMissing(
        `ALTER TABLE \`partner_agency\` ADD COLUMN \`document_no\` VARCHAR(120) NULL DEFAULT NULL`,
      );
    }
    if (!existing.has('expiry_date')) {
      await addColumnIfMissing(
        `ALTER TABLE \`partner_agency\` ADD COLUMN \`expiry_date\` DATE NULL DEFAULT NULL`,
      );
    }
    if (!existing.has('file_path')) {
      await addColumnIfMissing(
        `ALTER TABLE \`partner_agency\` ADD COLUMN \`file_path\` VARCHAR(255) NULL DEFAULT NULL`,
      );
    }

    // Enforce column order (phpMyAdmin shows in physical order).
    // Desired sequence: ... email, nationality, document_type, document_no, expiry_date, file_path, kyc_verified ...
    await pool.query(
      `ALTER TABLE \`partner_agency\`
        MODIFY COLUMN \`nationality\` CHAR(3) NULL DEFAULT NULL AFTER \`email\`,
        MODIFY COLUMN \`document_type\` VARCHAR(60) NULL DEFAULT NULL AFTER \`nationality\`,
        MODIFY COLUMN \`document_no\` VARCHAR(120) NULL DEFAULT NULL AFTER \`document_type\`,
        MODIFY COLUMN \`expiry_date\` DATE NULL DEFAULT NULL AFTER \`document_no\`,
        MODIFY COLUMN \`file_path\` VARCHAR(255) NULL DEFAULT NULL AFTER \`expiry_date\``,
    );
  }

  async function ensureUnitPhotoColumn() {
    const [rows] = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'unit'
        AND column_name = 'photo_data'
      `,
    );
    if (rows.length === 0) {
      await pool.query(
        `ALTER TABLE \`unit\` ADD COLUMN \`photo_data\` LONGTEXT NULL AFTER \`monthly_rent\``,
      );
    }

    const [activeRows] = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'unit'
        AND column_name = 'active'
      `,
    );
    if (activeRows.length === 0) {
      await pool.query(
        `ALTER TABLE \`unit\` ADD COLUMN \`active\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`status\``,
      );
    }

    const [remarksRows] = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'unit'
        AND column_name = 'special_remarks'
      `,
    );
    if (remarksRows.length === 0) {
      await pool.query(
        `ALTER TABLE \`unit\` ADD COLUMN \`special_remarks\` TEXT NULL AFTER \`inventory_json\``,
      );
    }

    const [metricRows] = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'unit'
        AND column_name IN ('area_sqm', 'bedrooms', 'bathrooms')
      `,
    );
    const existingMetrics = new Set(metricRows.map((r) => String(r.column_name)));
    if (!existingMetrics.has('area_sqm')) {
      await pool.query(
        `ALTER TABLE \`unit\` ADD COLUMN \`area_sqm\` DECIMAL(8,2) NULL DEFAULT NULL AFTER \`unit_type\``,
      );
    }
    if (!existingMetrics.has('bedrooms')) {
      await pool.query(
        `ALTER TABLE \`unit\` ADD COLUMN \`bedrooms\` TINYINT UNSIGNED NULL DEFAULT NULL AFTER \`area_sqm\``,
      );
    }
    if (!existingMetrics.has('bathrooms')) {
      await pool.query(
        `ALTER TABLE \`unit\` ADD COLUMN \`bathrooms\` TINYINT UNSIGNED NULL DEFAULT NULL AFTER \`bedrooms\``,
      );
    }
  }

  async function ensureUserAvatarColumn() {
    const [rows] = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'user_info'
        AND column_name = 'AVATAR_URL'
      `,
    );
    if (rows.length === 0) {
      try {
        await pool.query(
          `ALTER TABLE \`user_info\` ADD COLUMN \`AVATAR_URL\` VARCHAR(512) NULL DEFAULT NULL AFTER \`BRANCH_ID\``,
        );
      } catch (error) {
        if (error?.code !== 'ER_DUP_FIELDNAME') throw error;
      }
    }
  }

  async function ensureTenantDocumentCascade() {
    const [rows] = await pool.query(
      `
      SELECT delete_rule
      FROM information_schema.referential_constraints
      WHERE constraint_schema = DATABASE()
        AND constraint_name = 'fk_tenant_document_tenant'
      LIMIT 1
      `,
    );
    const deleteRule = String(rows[0]?.delete_rule ?? '').toUpperCase();
    if (deleteRule === 'CASCADE') return;

    await pool.query(
      'ALTER TABLE `tenant_document` DROP FOREIGN KEY `fk_tenant_document_tenant`',
    );
    await pool.query(
      `ALTER TABLE \`tenant_document\`
       ADD CONSTRAINT \`fk_tenant_document_tenant\`
       FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant_profile\` (\`id\`)
       ON DELETE CASCADE`,
    );
  }

  async function ensureContractsOperationsActiveColumns() {
    async function hasColumn(tableName, columnName) {
      const [rows] = await pool.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
        LIMIT 1
        `,
        [tableName, columnName],
      );
      return rows.length > 0;
    }

    if (!(await hasColumn('lease_contract', 'active'))) {
      await pool.query(
        `ALTER TABLE \`lease_contract\` ADD COLUMN \`active\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`status\``,
      );
    }
    if (!(await hasColumn('lease_contract', 'created_at'))) {
      await pool.query(
        `ALTER TABLE \`lease_contract\` ADD COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER \`created_by\``,
      );
    }
    if (!(await hasColumn('tenant_profile', 'created_at'))) {
      await pool.query(
        `ALTER TABLE \`tenant_profile\` ADD COLUMN \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER \`active\``,
      );
    }
    if (!(await hasColumn('inventory_snapshot', 'active'))) {
      await pool.query(
        `ALTER TABLE \`inventory_snapshot\` ADD COLUMN \`active\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`remarks\``,
      );
    }
    if (!(await hasColumn('inventory_snapshot_item', 'active'))) {
      await pool.query(
        `ALTER TABLE \`inventory_snapshot_item\` ADD COLUMN \`active\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`notes\``,
      );
    }
    if (!(await hasColumn('calendar_event', 'active'))) {
      await pool.query(
        `ALTER TABLE \`calendar_event\` ADD COLUMN \`active\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`metadata_json\``,
      );
    }
    if (!(await hasColumn('payment_schedule', 'active'))) {
      await pool.query(
        `ALTER TABLE \`payment_schedule\` ADD COLUMN \`active\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`status\``,
      );
    }
    if (!(await hasColumn('payment_transaction', 'active'))) {
      await pool.query(
        `ALTER TABLE \`payment_transaction\` ADD COLUMN \`active\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`payment_method\``,
      );
    }
  }

  async function ensureRoleAndContractMappingActiveColumns() {
    async function hasColumn(tableName, columnName) {
      const [rows] = await pool.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = ?
          AND column_name = ?
        LIMIT 1
        `,
        [tableName, columnName],
      );
      return rows.length > 0;
    }

    if (!(await hasColumn('role_sidebar_permissions', 'active'))) {
      await pool.query(
        `ALTER TABLE \`role_sidebar_permissions\` ADD COLUMN \`active\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`feature_key\``,
      );
    }
    if (!(await hasColumn('contract_tenant', 'active'))) {
      await pool.query(
        `ALTER TABLE \`contract_tenant\` ADD COLUMN \`active\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`is_primary\``,
      );
    }
    if (!(await hasColumn('contract_tenant', 'remarks'))) {
      await pool.query(
        `ALTER TABLE \`contract_tenant\` ADD COLUMN \`remarks\` TEXT NULL AFTER \`active\``,
      );
    }
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`user_role\` (
      \`IDNo\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`ROLE\` VARCHAR(128) NOT NULL,
      \`ENCODED_BY\` INT UNSIGNED NULL,
      \`ENCODED_DT\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`EDITED_BY\` INT UNSIGNED NULL,
      \`EDITED_DT\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      \`ACTIVE\` TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (\`IDNo\`),
      KEY \`idx_user_role_active\` (\`ACTIVE\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`user_info\` (
      \`IDNO\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`FIRSTNAME\` VARCHAR(128) NOT NULL,
      \`LASTNAME\` VARCHAR(128) NOT NULL,
      \`USERNAME\` VARCHAR(64) NOT NULL,
      \`PASSWORD\` VARCHAR(255) NOT NULL,
      \`SALT\` VARCHAR(255) NULL DEFAULT NULL,
      \`PERMISSIONS\` INT UNSIGNED NOT NULL,
      \`LAST_LOGIN\` DATETIME NULL DEFAULT NULL,
      \`ENCODED_BY\` INT UNSIGNED NULL,
      \`ENCODED_DT\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`EDITED_BY\` INT UNSIGNED NULL,
      \`EDITED_DT\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      \`ACTIVE\` TINYINT(1) NOT NULL DEFAULT 1,
      \`BRANCH_ID\` INT UNSIGNED NULL DEFAULT NULL,
      PRIMARY KEY (\`IDNO\`),
      UNIQUE KEY \`uk_user_info_username\` (\`USERNAME\`),
      KEY \`idx_user_info_branch\` (\`BRANCH_ID\`),
      KEY \`idx_user_info_permissions\` (\`PERMISSIONS\`),
      KEY \`idx_user_info_active\` (\`ACTIVE\`),
      CONSTRAINT \`fk_user_info_user_role\` FOREIGN KEY (\`PERMISSIONS\`) REFERENCES \`user_role\` (\`IDNo\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    INSERT IGNORE INTO \`user_role\` (\`IDNo\`, \`ROLE\`, \`ENCODED_BY\`, \`ENCODED_DT\`, \`EDITED_BY\`, \`EDITED_DT\`, \`ACTIVE\`) VALUES
      (1, 'Administrator', NULL, NOW(), NULL, NULL, 1),
      (2, 'Property Manager', NULL, NOW(), NULL, NULL, 1),
      (3, 'Leasing Agent', NULL, NOW(), NULL, NULL, 1),
      (4, 'Finance Officer', NULL, NOW(), NULL, NULL, 1),
      (5, 'Read Only', NULL, NOW(), NULL, NULL, 1)
  `);

  await pool.query(`
    INSERT IGNORE INTO \`user_info\` (
      \`IDNO\`, \`FIRSTNAME\`, \`LASTNAME\`, \`USERNAME\`, \`PASSWORD\`, \`SALT\`,
      \`PERMISSIONS\`, \`LAST_LOGIN\`, \`ENCODED_BY\`, \`ENCODED_DT\`, \`EDITED_BY\`, \`EDITED_DT\`, \`ACTIVE\`, \`BRANCH_ID\`
    ) VALUES
      (
        1,
        'Admin',
        'System',
        'admin',
        '$2b$10$talkLtFUrgOrZ52YqMGyEutyF.jOcHNI64s1HlV0ONl6Nh.x7eIH.',
        NULL,
        1,
        NULL,
        NULL,
        NOW(),
        NULL,
        NULL,
        1,
        1
      ),
      (
        2,
        'Maria',
        'Santos',
        'manager1',
        '$2b$10$talkLtFUrgOrZ52YqMGyEutyF.jOcHNI64s1HlV0ONl6Nh.x7eIH.',
        NULL,
        2,
        NULL,
        1,
        NOW(),
        NULL,
        NULL,
        1,
        1
      )
  `);

  await ensureUserAvatarColumn();

  await pool.query(`UPDATE \`user_role\` SET \`ENCODED_BY\` = 1 WHERE \`IDNo\` IN (1, 2, 3, 4, 5)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`branch\` (
      \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(160) NOT NULL,
      \`code\` VARCHAR(32) NULL DEFAULT NULL,
      \`ACTIVE\` TINYINT(1) NOT NULL DEFAULT 1,
      \`CREATED_DT\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_branch_code\` (\`code\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    INSERT IGNORE INTO \`branch\` (\`id\`, \`name\`, \`code\`, \`ACTIVE\`) VALUES
      (1, 'Main Office', 'BR001', 1),
      (2, 'North Annex', 'BR002', 1)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`branch_sidebar_permissions\` (
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`feature_key\` VARCHAR(64) NOT NULL,
      PRIMARY KEY (\`branch_id\`, \`feature_key\`),
      KEY \`idx_bsp_branch\` (\`branch_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  const branchSidebarValues = [];
  for (const branchId of [1, 2]) {
    for (const fk of SIDEBAR_FEATURE_KEYS) {
      branchSidebarValues.push(`(${branchId}, '${fk}')`);
    }
  }
  await pool.query(
    `INSERT IGNORE INTO \`branch_sidebar_permissions\` (\`branch_id\`, \`feature_key\`) VALUES ${branchSidebarValues.join(',')}`,
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`user_role_crud_permissions\` (
      \`role_id\` INT UNSIGNED NOT NULL,
      \`module_key\` VARCHAR(64) NOT NULL,
      \`can_create\` TINYINT(1) NOT NULL DEFAULT 0,
      \`can_update\` TINYINT(1) NOT NULL DEFAULT 0,
      \`can_delete\` TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (\`role_id\`, \`module_key\`),
      KEY \`idx_urcp_role\` (\`role_id\`),
      CONSTRAINT \`fk_urcp_user_role\` FOREIGN KEY (\`role_id\`) REFERENCES \`user_role\` (\`IDNo\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    INSERT IGNORE INTO \`user_role_crud_permissions\`
      (\`role_id\`, \`module_key\`, \`can_create\`, \`can_update\`, \`can_delete\`) VALUES
      (1, 'dashboard',       0, 0, 0),
      (1, 'units',           1, 1, 1),
      (1, 'contracts',       1, 1, 1),
      (1, 'crm',             1, 1, 1),
      (1, 'ledger',          1, 1, 0),
      (1, 'calendar',        1, 1, 1),
      (1, 'tenant_portal',   0, 0, 0),
      (1, 'agent_portal',    0, 0, 0),
      (2, 'dashboard',       0, 0, 0),
      (2, 'units',           1, 1, 1),
      (2, 'contracts',       1, 1, 1),
      (2, 'crm',             1, 1, 1),
      (2, 'ledger',          1, 1, 0),
      (2, 'calendar',        1, 1, 1),
      (2, 'tenant_portal',   0, 0, 0),
      (2, 'agent_portal',    0, 0, 0),
      (3, 'dashboard',       0, 0, 0),
      (3, 'units',           1, 1, 0),
      (3, 'contracts',       1, 1, 0),
      (3, 'crm',             1, 1, 0),
      (3, 'ledger',          1, 1, 0),
      (3, 'calendar',        1, 1, 1),
      (3, 'tenant_portal',   0, 0, 0),
      (3, 'agent_portal',    0, 0, 0),
      (4, 'dashboard',       0, 0, 0),
      (4, 'units',           0, 1, 0),
      (4, 'contracts',       0, 1, 0),
      (4, 'crm',             0, 1, 0),
      (4, 'ledger',          1, 1, 0),
      (4, 'calendar',        0, 1, 0),
      (4, 'tenant_portal',   0, 0, 0),
      (4, 'agent_portal',    0, 0, 0),
      (5, 'dashboard',       0, 0, 0),
      (5, 'units',           0, 0, 0),
      (5, 'contracts',       0, 0, 0),
      (5, 'crm',             0, 0, 0),
      (5, 'ledger',          0, 0, 0),
      (5, 'calendar',        0, 0, 0),
      (5, 'tenant_portal',   0, 0, 0),
      (5, 'agent_portal',    0, 0, 0)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`role_sidebar_permissions\` (
      \`role_id\` INT UNSIGNED NOT NULL,
      \`feature_key\` VARCHAR(64) NOT NULL,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (\`role_id\`, \`feature_key\`),
      KEY \`idx_rsp_role\` (\`role_id\`),
      CONSTRAINT \`fk_rsp_user_role\` FOREIGN KEY (\`role_id\`) REFERENCES \`user_role\` (\`IDNo\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  // Existing DBs may already have this table without `active`; patch before seed INSERT.
  await ensureRoleAndContractMappingActiveColumns();

  const values = [];
  for (let roleId = 1; roleId <= 5; roleId++) {
    for (const fk of SIDEBAR_FEATURE_KEYS) {
      values.push(`(${roleId}, '${fk}')`);
    }
  }
  await pool.query(
    `INSERT IGNORE INTO \`role_sidebar_permissions\` (\`role_id\`, \`feature_key\`, \`active\`) VALUES ${values
      .map((v) => `${v.slice(0, -1)}, 1)`)
      .join(',')}`,
  );

  await pool.query(`DELETE FROM \`role_sidebar_permissions\` WHERE \`feature_key\` = 'user_management'`);
  await pool.query(`DELETE FROM \`branch_sidebar_permissions\` WHERE \`feature_key\` = 'user_management'`);
  await pool.query(`DELETE FROM \`user_role_crud_permissions\` WHERE \`module_key\` = 'user_management'`);

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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
      \`photo_data\` LONGTEXT NULL,
      \`market_value\` DECIMAL(14,2) NULL DEFAULT NULL,
      \`inventory_json\` LONGTEXT NULL,
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  await ensureUnitPhotoColumn();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`partner_agency\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`agency_name\` VARCHAR(180) NOT NULL,
      \`contact_person\` VARCHAR(140) NULL DEFAULT NULL,
      \`contact_number\` VARCHAR(40) NULL DEFAULT NULL,
      \`email\` VARCHAR(180) NULL DEFAULT NULL,
      \`nationality\` CHAR(3) NULL DEFAULT NULL,
      \`document_type\` VARCHAR(60) NULL DEFAULT NULL,
      \`document_no\` VARCHAR(120) NULL DEFAULT NULL,
      \`expiry_date\` DATE NULL DEFAULT NULL,
      \`file_path\` VARCHAR(255) NULL DEFAULT NULL,
      \`kyc_verified\` TINYINT(1) NOT NULL DEFAULT 0,
      \`is_blacklisted\` TINYINT(1) NOT NULL DEFAULT 0,
      \`blacklist_reason\` VARCHAR(500) NULL DEFAULT NULL,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_partner_agency_branch_name\` (\`branch_id\`, \`agency_name\`),
      KEY \`idx_partner_agency_branch\` (\`branch_id\`),
      CONSTRAINT \`fk_partner_agency_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  await ensurePartnerAgencyDocColumns();

  const [partnerAgencyCountRows] = await pool.query('SELECT COUNT(*) AS n FROM partner_agency');
  const pan = Number(partnerAgencyCountRows[0]?.n ?? 0);
  if (pan === 0) {
    await pool.query(
      `INSERT IGNORE INTO partner_agency (branch_id, agency_name, contact_person, contact_number, email, kyc_verified, is_blacklisted, active) VALUES
        (1, 'Prime Realty', 'Alice Brown', '0917-123-4567', NULL, 0, 0, 1),
        (1, 'Elite Estates', 'Bob Green', '0918-987-6543', NULL, 0, 0, 1)`,
    );
  }

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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`tenant_profile\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`full_name\` VARCHAR(180) NOT NULL,
      \`email\` VARCHAR(180) NULL DEFAULT NULL,
      \`mobile_no\` VARCHAR(40) NULL DEFAULT NULL,
      \`nationality\` VARCHAR(80) NULL DEFAULT NULL,
      \`birth_date\` DATE NULL DEFAULT NULL,
      \`kyc_verified\` TINYINT(1) NOT NULL DEFAULT 1,
      \`is_blacklisted\` TINYINT(1) NOT NULL DEFAULT 0,
      \`blacklist_reason\` VARCHAR(500) NULL DEFAULT NULL,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_tenant_name\` (\`full_name\`),
      KEY \`idx_tenant_branch\` (\`branch_id\`),
      CONSTRAINT \`fk_tenant_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);


  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`lease_contract\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`contract_no\` VARCHAR(60) NOT NULL,
      \`unit_id\` BIGINT UNSIGNED NOT NULL,
      \`landlord_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`agent_id\` INT UNSIGNED NULL DEFAULT NULL COMMENT 'Who closed deal',
      \`partner_agency_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`contract_type\` ENUM('monthly_rental','selling','short_term_rental') NOT NULL DEFAULT 'monthly_rental',
      \`status\` ENUM('draft','active','completed','terminated','cancelled') NOT NULL DEFAULT 'draft',
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`start_date\` DATE NOT NULL,
      \`end_date\` DATE NOT NULL,
      \`move_in_date\` DATE NULL DEFAULT NULL,
      \`move_out_date\` DATE NULL DEFAULT NULL,
      \`monthly_rent\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      \`security_deposit\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      \`advance_rent\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      \`manual_profit_override\` DECIMAL(14,2) NULL DEFAULT NULL,
      \`profit_override_note\` VARCHAR(255) NULL DEFAULT NULL,
      \`special_remarks\` TEXT NULL,
      \`created_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_contract_no\` (\`contract_no\`),
      KEY \`idx_lease_contract_branch\` (\`branch_id\`),
      KEY \`idx_lease_contract_status_dates\` (\`status\`, \`start_date\`, \`end_date\`),
      KEY \`idx_lease_contract_agent\` (\`agent_id\`),
      CONSTRAINT \`fk_contract_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_contract_unit\` FOREIGN KEY (\`unit_id\`) REFERENCES \`unit\` (\`id\`),
      CONSTRAINT \`fk_contract_landlord\` FOREIGN KEY (\`landlord_id\`) REFERENCES \`landlord_profile\` (\`id\`),
      CONSTRAINT \`fk_contract_agent\` FOREIGN KEY (\`agent_id\`) REFERENCES \`user_info\` (\`IDNO\`),
      CONSTRAINT \`fk_contract_partner_agency\` FOREIGN KEY (\`partner_agency_id\`) REFERENCES \`partner_agency\` (\`id\`),
      CONSTRAINT \`fk_contract_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`contract_tenant\` (
      \`contract_id\` BIGINT UNSIGNED NOT NULL,
      \`tenant_id\` BIGINT UNSIGNED NOT NULL,
      \`is_primary\` TINYINT(1) NOT NULL DEFAULT 0,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`remarks\` TEXT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`contract_id\`, \`tenant_id\`),
      KEY \`idx_contract_tenant_tenant\` (\`tenant_id\`),
      CONSTRAINT \`fk_ct_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_ct_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant_profile\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  // Existing DBs may already have this table without `active`; patch before runtime INSERTs.
  await ensureRoleAndContractMappingActiveColumns();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`blacklist_record\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`entity_type\` ENUM('tenant','landlord','broker') NOT NULL,
      \`tenant_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`landlord_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`partner_agency_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`reason\` VARCHAR(255) NOT NULL,
      \`details\` TEXT NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`tagged_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`tagged_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_blacklist_branch\` (\`branch_id\`),
      KEY \`idx_blacklist_entity\` (\`entity_type\`, \`is_active\`),
      KEY \`idx_blacklist_partner_agency\` (\`partner_agency_id\`),
      CONSTRAINT \`fk_blacklist_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_blacklist_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant_profile\` (\`id\`),
      CONSTRAINT \`fk_blacklist_landlord\` FOREIGN KEY (\`landlord_id\`) REFERENCES \`landlord_profile\` (\`id\`),
      CONSTRAINT \`fk_blacklist_partner_agency\` FOREIGN KEY (\`partner_agency_id\`) REFERENCES \`partner_agency\` (\`id\`),
      CONSTRAINT \`fk_blacklist_tagged_by\` FOREIGN KEY (\`tagged_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`blacklist\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`entity_type\` ENUM('tenant','broker') NOT NULL,
      \`name\` VARCHAR(255) NOT NULL,
      \`email\` VARCHAR(255) NULL DEFAULT NULL,
      \`phone\` VARCHAR(64) NULL DEFAULT NULL,
      \`government_id\` VARCHAR(128) NULL DEFAULT NULL,
      \`reason\` TEXT NOT NULL,
      \`blacklisted_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`tenant_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`partner_agency_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_blacklist_branch_active\` (\`branch_id\`, \`is_active\`),
      KEY \`idx_blacklist_entity\` (\`entity_type\`, \`is_active\`),
      KEY \`idx_blacklist_email\` (\`email\`),
      KEY \`idx_blacklist_phone\` (\`phone\`),
      KEY \`idx_blacklist_government_id\` (\`government_id\`),
      KEY \`idx_blacklist_tenant\` (\`tenant_id\`),
      KEY \`idx_blacklist_partner\` (\`partner_agency_id\`),
      CONSTRAINT \`fk_blacklist_v2_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_blacklist_v2_by\` FOREIGN KEY (\`blacklisted_by\`) REFERENCES \`user_info\` (\`IDNO\`),
      CONSTRAINT \`fk_blacklist_v2_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant_profile\` (\`id\`),
      CONSTRAINT \`fk_blacklist_v2_partner\` FOREIGN KEY (\`partner_agency_id\`) REFERENCES \`partner_agency\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await migrateLegacyBlacklistRecords();

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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
      CONSTRAINT \`fk_tenant_document_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant_profile\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_tenant_document_verified_by\` FOREIGN KEY (\`verified_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  await ensureTenantDocumentCascade();

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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`notes\` VARCHAR(255) NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_payment_schedule_branch\` (\`branch_id\`),
      KEY \`idx_payment_schedule_contract_due\` (\`contract_id\`, \`due_date\`),
      KEY \`idx_payment_schedule_status_due\` (\`status\`, \`due_date\`),
      CONSTRAINT \`fk_payment_schedule_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_payment_schedule_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_payment_schedule_invoice\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoice\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  // Demo lease + payment schedule for empty dev DBs (enables Lease Ledger + Record Payment end-to-end).
  try {
    const [lcCountRows] = await pool.query('SELECT COUNT(*) AS n FROM lease_contract');
    const lcN = Number(lcCountRows[0]?.n ?? 0);
    if (lcN === 0) {
      const [[unitRow]] = await pool.query(
        'SELECT id, monthly_rent FROM unit WHERE active = 1 ORDER BY id ASC LIMIT 1',
      );
      const [[tenantRow]] = await pool.query(
        `SELECT id FROM tenant_profile
         WHERE active = 1 AND (branch_id = 1 OR branch_id IS NULL)
         ORDER BY (branch_id = 1) DESC, id ASC
         LIMIT 1`,
      );
      const [[agentRow]] = await pool.query('SELECT IDNO FROM user_info WHERE ACTIVE = 1 ORDER BY IDNO ASC LIMIT 1');

      const unitId = unitRow?.id;
      const tenantId = tenantRow?.id;
      const agentId = agentRow?.IDNO ?? null;
      const rent = Number(unitRow?.monthly_rent ?? 0) > 0 ? Number(unitRow.monthly_rent) : 35000;

      if (unitId != null && tenantId != null) {
        const [insLc] = await pool.query(
          `INSERT INTO lease_contract (
            branch_id,
            contract_no,
            unit_id,
            landlord_id,
            agent_id,
            partner_agency_id,
            contract_type,
            status,
            start_date,
            end_date,
            monthly_rent,
            security_deposit,
            advance_rent,
            special_remarks,
            created_by
          ) VALUES (
            1,
            'LC-BOOT-001',
            ?,
            NULL,
            ?,
            NULL,
            'monthly_rental',
            'active',
            CURDATE() - INTERVAL 30 DAY,
            CURDATE() + INTERVAL 335 DAY,
            ?,
            ?,
            ?,
            'Bootstrap contract for local dev (auto-created when DB is empty).',
            ?
          )`,
          [unitId, agentId, rent, rent * 2, rent, agentId],
        );

        const contractId = insLc.insertId;
        await pool.query(
          `INSERT INTO contract_tenant (contract_id, tenant_id, is_primary, active) VALUES (?, ?, 1, 1)
           ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary), active = 1`,
          [contractId, tenantId],
        );

        const [psCountRows] = await pool.query('SELECT COUNT(*) AS n FROM payment_schedule');
        const psN = Number(psCountRows[0]?.n ?? 0);
        if (psN === 0) {
          await pool.query(
            `INSERT INTO payment_schedule (
              branch_id, contract_id, invoice_id, due_date, amount_due, status, notes
            ) VALUES (?, ?, NULL, DATE_FORMAT(CURDATE(), '%Y-%m-01'), ?, 'pending', 'Bootstrap rent schedule (dev)')`,
            [1, contractId, rent],
          );
        }
      }
    }
  } catch (e) {
    console.error('[ensureSchema] lease/payment bootstrap skipped:', e);
  }

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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_inventory_snapshot_branch\` (\`branch_id\`),
      KEY \`idx_inventory_snapshot_contract_type\` (\`contract_id\`, \`snapshot_type\`),
      CONSTRAINT \`fk_inventory_snapshot_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_inventory_snapshot_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_inventory_snapshot_inspected_by\` FOREIGN KEY (\`inspected_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (\`id\`),
      KEY \`idx_inventory_item_snapshot\` (\`snapshot_id\`),
      CONSTRAINT \`fk_inventory_item_snapshot\` FOREIGN KEY (\`snapshot_id\`) REFERENCES \`inventory_snapshot\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
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
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_calendar_event_branch\` (\`branch_id\`),
      KEY \`idx_calendar_event_date_type\` (\`event_date\`, \`event_type\`),
      CONSTRAINT \`fk_calendar_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_calendar_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_calendar_payment_schedule\` FOREIGN KEY (\`payment_schedule_id\`) REFERENCES \`payment_schedule\` (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
  await ensureContractsOperationsActiveColumns();
  await ensureRoleAndContractMappingActiveColumns();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`unit_inspection\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`contract_id\` BIGINT UNSIGNED NOT NULL,
      \`unit_id\` BIGINT UNSIGNED NOT NULL,
      \`status\` ENUM('vacant','under_inspection','pending_approval','ready_for_occupancy','move_in_scheduled','occupied','failed') NOT NULL DEFAULT 'vacant',
      \`workflow_step\` ENUM('overview','checklist','inventory','photos','approval','ready','logs') NOT NULL DEFAULT 'overview',
      \`scheduled_move_in\` DATE NULL DEFAULT NULL,
      \`inspector_remarks\` TEXT NULL,
      \`checklist_score\` DECIMAL(5,2) NOT NULL DEFAULT 0,
      \`inventory_completion\` DECIMAL(5,2) NOT NULL DEFAULT 0,
      \`photos_complete\` TINYINT(1) NOT NULL DEFAULT 0,
      \`started_at\` DATETIME NULL DEFAULT NULL,
      \`approved_at\` DATETIME NULL DEFAULT NULL,
      \`approved_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`failed_at\` DATETIME NULL DEFAULT NULL,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_unit_inspection_contract\` (\`contract_id\`),
      KEY \`idx_unit_inspection_branch\` (\`branch_id\`),
      KEY \`idx_unit_inspection_unit\` (\`unit_id\`),
      CONSTRAINT \`fk_unit_inspection_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_unit_inspection_contract\` FOREIGN KEY (\`contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_unit_inspection_unit\` FOREIGN KEY (\`unit_id\`) REFERENCES \`unit\` (\`id\`),
      CONSTRAINT \`fk_unit_inspection_approved_by\` FOREIGN KEY (\`approved_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`inspection_checklist\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`inspection_id\` BIGINT UNSIGNED NOT NULL,
      \`item_key\` VARCHAR(80) NOT NULL,
      \`item_label\` VARCHAR(180) NOT NULL,
      \`result\` ENUM('pending','pass','fail') NOT NULL DEFAULT 'pending',
      \`remarks\` TEXT NULL,
      \`photo_data_url\` LONGTEXT NULL,
      \`sort_order\` INT UNSIGNED NOT NULL DEFAULT 0,
      \`updated_at\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_inspection_checklist_item\` (\`inspection_id\`, \`item_key\`),
      KEY \`idx_inspection_checklist_inspection\` (\`inspection_id\`),
      CONSTRAINT \`fk_inspection_checklist_inspection\` FOREIGN KEY (\`inspection_id\`) REFERENCES \`unit_inspection\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`inspection_photo\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`inspection_id\` BIGINT UNSIGNED NOT NULL,
      \`section\` ENUM('living_room','bedroom','kitchen','bathroom','damages','meter_reading') NOT NULL,
      \`photo_data_url\` LONGTEXT NOT NULL,
      \`caption\` VARCHAR(255) NULL DEFAULT NULL,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_inspection_photo_inspection\` (\`inspection_id\`, \`section\`),
      CONSTRAINT \`fk_inspection_photo_inspection\` FOREIGN KEY (\`inspection_id\`) REFERENCES \`unit_inspection\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`inventory_verification\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`inspection_id\` BIGINT UNSIGNED NOT NULL,
      \`item_key\` VARCHAR(80) NOT NULL,
      \`item_label\` VARCHAR(180) NOT NULL,
      \`condition_state\` ENUM('pending','good','damaged','missing') NOT NULL DEFAULT 'pending',
      \`quantity\` INT UNSIGNED NOT NULL DEFAULT 1,
      \`remarks\` TEXT NULL,
      \`sort_order\` INT UNSIGNED NOT NULL DEFAULT 0,
      \`updated_at\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_inventory_verification_item\` (\`inspection_id\`, \`item_key\`),
      KEY \`idx_inventory_verification_inspection\` (\`inspection_id\`),
      CONSTRAINT \`fk_inventory_verification_inspection\` FOREIGN KEY (\`inspection_id\`) REFERENCES \`unit_inspection\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`inspection_log\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`inspection_id\` BIGINT UNSIGNED NOT NULL,
      \`event_type\` VARCHAR(80) NOT NULL,
      \`message\` TEXT NOT NULL,
      \`actor_user_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_inspection_log_inspection\` (\`inspection_id\`, \`created_at\`),
      CONSTRAINT \`fk_inspection_log_inspection\` FOREIGN KEY (\`inspection_id\`) REFERENCES \`unit_inspection\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_inspection_log_actor\` FOREIGN KEY (\`actor_user_id\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`audit_log\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`actor_user_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`module_name\` VARCHAR(80) NOT NULL,
      \`record_table\` VARCHAR(80) NOT NULL,
      \`record_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`action\` ENUM('create','update','delete','status_change','override','login') NOT NULL,
      \`change_summary\` TEXT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_audit_branch\` (\`branch_id\`),
      KEY \`idx_audit_module_date\` (\`module_name\`, \`created_at\`),
      CONSTRAINT \`fk_audit_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_audit_actor_user\` FOREIGN KEY (\`actor_user_id\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`lease_renewals\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT UNSIGNED NOT NULL,
      \`old_contract_id\` BIGINT UNSIGNED NOT NULL,
      \`new_contract_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
      \`tenant_id\` BIGINT UNSIGNED NOT NULL,
      \`unit_id\` BIGINT UNSIGNED NOT NULL,
      \`renewal_status\` ENUM('pending_renewal','awaiting_payment','pending_signature','ready_to_activate','active','declined') NOT NULL DEFAULT 'pending_renewal',
      \`workflow_step\` ENUM('summary','balance','terms','agreement','approval','activation') NOT NULL DEFAULT 'summary',
      \`outstanding_balance\` DECIMAL(12,2) NOT NULL DEFAULT 0,
      \`balance_breakdown_json\` JSON NULL,
      \`carry_over_balance\` TINYINT(1) NOT NULL DEFAULT 0,
      \`carry_over_reason\` TEXT NULL,
      \`internal_notes\` TEXT NULL,
      \`terms_json\` JSON NULL,
      \`rent_increase_percentage\` DECIMAL(6,2) NULL DEFAULT NULL,
      \`approval_status\` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      \`tenant_signature_status\` ENUM('pending','signed','rejected') NOT NULL DEFAULT 'pending',
      \`manager_approval_notes\` TEXT NULL,
      \`signed_at\` DATETIME NULL DEFAULT NULL,
      \`activation_date\` DATE NULL DEFAULT NULL,
      \`created_by\` INT UNSIGNED NULL DEFAULT NULL,
      \`active\` TINYINT(1) NOT NULL DEFAULT 1,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_lease_renewals_branch\` (\`branch_id\`),
      KEY \`idx_lease_renewals_old_contract\` (\`old_contract_id\`),
      KEY \`idx_lease_renewals_tenant\` (\`tenant_id\`),
      KEY \`idx_lease_renewals_status\` (\`renewal_status\`),
      CONSTRAINT \`fk_lease_renewals_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
      CONSTRAINT \`fk_lease_renewals_old_contract\` FOREIGN KEY (\`old_contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_lease_renewals_new_contract\` FOREIGN KEY (\`new_contract_id\`) REFERENCES \`lease_contract\` (\`id\`),
      CONSTRAINT \`fk_lease_renewals_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenant_profile\` (\`id\`),
      CONSTRAINT \`fk_lease_renewals_unit\` FOREIGN KEY (\`unit_id\`) REFERENCES \`unit\` (\`id\`),
      CONSTRAINT \`fk_lease_renewals_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`lease_renewal_approvals\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`renewal_id\` BIGINT UNSIGNED NOT NULL,
      \`approver_role\` VARCHAR(64) NOT NULL DEFAULT 'manager',
      \`approver_user_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`status\` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      \`notes\` TEXT NULL,
      \`decided_at\` DATETIME NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_lease_renewal_approvals_renewal\` (\`renewal_id\`),
      CONSTRAINT \`fk_lease_renewal_approvals_renewal\` FOREIGN KEY (\`renewal_id\`) REFERENCES \`lease_renewals\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_lease_renewal_approvals_user\` FOREIGN KEY (\`approver_user_id\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`lease_renewal_logs\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`renewal_id\` BIGINT UNSIGNED NOT NULL,
      \`event_type\` VARCHAR(64) NOT NULL,
      \`message\` TEXT NOT NULL,
      \`actor_user_id\` INT UNSIGNED NULL DEFAULT NULL,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_lease_renewal_logs_renewal\` (\`renewal_id\`, \`created_at\`),
      CONSTRAINT \`fk_lease_renewal_logs_renewal\` FOREIGN KEY (\`renewal_id\`) REFERENCES \`lease_renewals\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_lease_renewal_logs_actor\` FOREIGN KEY (\`actor_user_id\`) REFERENCES \`user_info\` (\`IDNO\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  async function ensureLandlordCrmColumns() {
    async function addColumnIfMissing(sql) {
      try {
        await pool.query(sql);
      } catch (error) {
        if (error?.code !== 'ER_DUP_FIELDNAME') throw error;
      }
    }

    const landlordCols = [
      'first_name',
      'middle_name',
      'last_name',
      'company_name',
      'birth_date',
      'address',
      'city',
      'province',
      'postal_code',
      'id_type',
      'id_number',
      'id_front_url',
      'id_back_url',
      'tin',
      'proof_of_address_url',
      'bank_name',
      'account_name',
      'account_number',
      'gcash',
      'maya',
      'internal_notes',
      'kyc_status',
      'account_status',
      'assigned_agent_id',
      'last_activity_at',
      'updated_at',
    ];
    const [landlordRows] = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'landlord_profile'
        AND column_name IN (${landlordCols.map(() => '?').join(', ')})
      `,
      landlordCols,
    );
    const existingLandlord = new Set(landlordRows.map((r) => String(r.column_name)));

    const landlordAlters = [
      ['first_name', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`first_name\` VARCHAR(80) NULL DEFAULT NULL AFTER \`full_name\``],
      ['middle_name', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`middle_name\` VARCHAR(80) NULL DEFAULT NULL AFTER \`first_name\``],
      ['last_name', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`last_name\` VARCHAR(80) NULL DEFAULT NULL AFTER \`middle_name\``],
      ['company_name', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`company_name\` VARCHAR(180) NULL DEFAULT NULL AFTER \`last_name\``],
      ['birth_date', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`birth_date\` DATE NULL DEFAULT NULL AFTER \`email\``],
      ['address', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`address\` VARCHAR(255) NULL DEFAULT NULL AFTER \`birth_date\``],
      ['city', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`city\` VARCHAR(100) NULL DEFAULT NULL AFTER \`address\``],
      ['province', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`province\` VARCHAR(100) NULL DEFAULT NULL AFTER \`city\``],
      ['postal_code', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`postal_code\` VARCHAR(20) NULL DEFAULT NULL AFTER \`province\``],
      ['id_type', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`id_type\` VARCHAR(60) NULL DEFAULT NULL AFTER \`gov_id_no\``],
      ['id_number', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`id_number\` VARCHAR(100) NULL DEFAULT NULL AFTER \`id_type\``],
      ['id_front_url', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`id_front_url\` VARCHAR(512) NULL DEFAULT NULL AFTER \`id_number\``],
      ['id_back_url', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`id_back_url\` VARCHAR(512) NULL DEFAULT NULL AFTER \`id_front_url\``],
      ['tin', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`tin\` VARCHAR(40) NULL DEFAULT NULL AFTER \`id_back_url\``],
      ['proof_of_address_url', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`proof_of_address_url\` VARCHAR(512) NULL DEFAULT NULL AFTER \`tin\``],
      ['bank_name', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`bank_name\` VARCHAR(120) NULL DEFAULT NULL AFTER \`proof_of_address_url\``],
      ['account_name', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`account_name\` VARCHAR(180) NULL DEFAULT NULL AFTER \`bank_name\``],
      ['account_number', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`account_number\` VARCHAR(60) NULL DEFAULT NULL AFTER \`account_name\``],
      ['gcash', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`gcash\` VARCHAR(40) NULL DEFAULT NULL AFTER \`account_number\``],
      ['maya', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`maya\` VARCHAR(40) NULL DEFAULT NULL AFTER \`gcash\``],
      ['internal_notes', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`internal_notes\` TEXT NULL AFTER \`maya\``],
      [
        'kyc_status',
        `ALTER TABLE \`landlord_profile\` ADD COLUMN \`kyc_status\` ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending' AFTER \`internal_notes\``,
      ],
      [
        'account_status',
        `ALTER TABLE \`landlord_profile\` ADD COLUMN \`account_status\` ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active' AFTER \`kyc_status\``,
      ],
      ['assigned_agent_id', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`assigned_agent_id\` INT UNSIGNED NULL DEFAULT NULL AFTER \`account_status\``],
      ['last_activity_at', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`last_activity_at\` DATETIME NULL DEFAULT NULL AFTER \`assigned_agent_id\``],
      ['updated_at', `ALTER TABLE \`landlord_profile\` ADD COLUMN \`updated_at\` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER \`created_at\``],
    ];
    for (const [col, sql] of landlordAlters) {
      if (!existingLandlord.has(col)) await addColumnIfMissing(sql);
    }

    const [propertyRows] = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'property'
        AND column_name = 'landlord_id'
      `,
    );
    if (!propertyRows.length) {
      await addColumnIfMissing(
        `ALTER TABLE \`property\` ADD COLUMN \`landlord_id\` BIGINT UNSIGNED NULL DEFAULT NULL AFTER \`area_id\``,
      );
      try {
        await pool.query(
          `ALTER TABLE \`property\`
           ADD CONSTRAINT \`fk_property_landlord\` FOREIGN KEY (\`landlord_id\`) REFERENCES \`landlord_profile\` (\`id\`)`,
        );
      } catch (error) {
        if (error?.code !== 'ER_DUP_KEYNAME' && error?.code !== 'ER_CANT_CREATE_TABLE') {
          // FK may already exist or landlord table missing in legacy DBs.
        }
      }
    }

    const [leaseLandlordRows] = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'lease_contract'
        AND column_name = 'landlord_id'
      `,
    );
    if (!leaseLandlordRows.length) {
      await addColumnIfMissing(
        `ALTER TABLE \`lease_contract\` ADD COLUMN \`landlord_id\` BIGINT UNSIGNED NULL DEFAULT NULL AFTER \`unit_id\``,
      );
      try {
        await pool.query(
          `ALTER TABLE \`lease_contract\`
           ADD CONSTRAINT \`fk_contract_landlord\` FOREIGN KEY (\`landlord_id\`) REFERENCES \`landlord_profile\` (\`id\`)`,
        );
      } catch (error) {
        if (error?.code !== 'ER_DUP_KEYNAME' && error?.code !== 'ER_CANT_CREATE_TABLE') {
          // FK may already exist on legacy DBs.
        }
      }
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`landlord_document\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`branch_id\` INT UNSIGNED NOT NULL,
        \`landlord_id\` BIGINT UNSIGNED NOT NULL,
        \`document_type\` ENUM('government_id','land_title','tax_declaration','lease_authorization','business_permit','proof_of_address','other') NOT NULL DEFAULT 'other',
        \`title\` VARCHAR(180) NOT NULL,
        \`file_path\` VARCHAR(512) NOT NULL,
        \`uploaded_by\` INT UNSIGNED NULL DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_landlord_document_branch\` (\`branch_id\`),
        KEY \`idx_landlord_document_landlord\` (\`landlord_id\`),
        CONSTRAINT \`fk_landlord_document_branch\` FOREIGN KEY (\`branch_id\`) REFERENCES \`branch\` (\`id\`),
        CONSTRAINT \`fk_landlord_document_landlord\` FOREIGN KEY (\`landlord_id\`) REFERENCES \`landlord_profile\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_landlord_document_uploaded_by\` FOREIGN KEY (\`uploaded_by\`) REFERENCES \`user_info\` (\`IDNO\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
  }

  await ensureLandlordCrmColumns();

}
