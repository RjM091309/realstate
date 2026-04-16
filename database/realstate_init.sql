-- =============================================================================
-- realstate — local starter schema
-- Control Panel: branch_sidebar_permissions, user_role_crud_permissions
-- Users: user_role, user_info (PERMISSIONS -> user_role.IDNo)
--
-- Import: mysql -u root -p < database/realstate_init.sql
-- Or paste into phpMyAdmin SQL tab.
--
-- Dev login (local only): username admin / password admin123
--   (bcrypt; replace in production with Argon2id or your app’s verifier)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `realstate` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `realstate`;

SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `audit_log`;
DROP TABLE IF EXISTS `calendar_event`;
DROP TABLE IF EXISTS `inventory_snapshot_item`;
DROP TABLE IF EXISTS `inventory_snapshot`;
DROP TABLE IF EXISTS `special_request`;
DROP TABLE IF EXISTS `contract_collaboration`;
DROP TABLE IF EXISTS `payment_transaction`;
DROP TABLE IF EXISTS `payment_schedule`;
DROP TABLE IF EXISTS `invoice`;
DROP TABLE IF EXISTS `tenant_document`;
DROP TABLE IF EXISTS `document_repository`;
DROP TABLE IF EXISTS `document_template`;
DROP TABLE IF EXISTS `blacklist_record`;
DROP TABLE IF EXISTS `contract_tenant`;
DROP TABLE IF EXISTS `lease_contract`;
DROP TABLE IF EXISTS `tenant_profile`;
DROP TABLE IF EXISTS `landlord_profile`;
DROP TABLE IF EXISTS `partner_agency`;
DROP TABLE IF EXISTS `unit`;
DROP TABLE IF EXISTS `property`;
DROP TABLE IF EXISTS `area`;
DROP TABLE IF EXISTS `user_info`;
DROP TABLE IF EXISTS `user_role_crud_permissions`;
DROP TABLE IF EXISTS `role_sidebar_permissions`;
DROP TABLE IF EXISTS `branch_sidebar_permissions`;
DROP TABLE IF EXISTS `branch`;
DROP TABLE IF EXISTS `user_role`;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- user_role (matches legacy pattern: IDNo, ROLE, audit columns, ACTIVE)
-- ---------------------------------------------------------------------------
CREATE TABLE `user_role` (
  `IDNo` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `ROLE` VARCHAR(128) NOT NULL,
  `ENCODED_BY` INT UNSIGNED NULL,
  `ENCODED_DT` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `EDITED_BY` INT UNSIGNED NULL,
  `EDITED_DT` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `ACTIVE` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`IDNo`),
  KEY `idx_user_role_active` (`ACTIVE`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Staff roles; IDNo referenced by user_info.PERMISSIONS and user_role_crud_permissions.role_id';

-- ---------------------------------------------------------------------------
-- user_info (PERMISSIONS = user_role.IDNo; BRANCH_ID aligns with branch_* tables)
-- ---------------------------------------------------------------------------
CREATE TABLE `user_info` (
  `IDNO` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `FIRSTNAME` VARCHAR(128) NOT NULL,
  `LASTNAME` VARCHAR(128) NOT NULL,
  `USERNAME` VARCHAR(64) NOT NULL,
  `PASSWORD` VARCHAR(255) NOT NULL,
  `SALT` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Optional if app uses salt + hash',
  `PERMISSIONS` INT UNSIGNED NOT NULL COMMENT 'FK to user_role.IDNo',
  `LAST_LOGIN` DATETIME NULL DEFAULT NULL,
  `ENCODED_BY` INT UNSIGNED NULL,
  `ENCODED_DT` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `EDITED_BY` INT UNSIGNED NULL,
  `EDITED_DT` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `ACTIVE` TINYINT(1) NOT NULL DEFAULT 1,
  `BRANCH_ID` INT UNSIGNED NULL DEFAULT NULL,
  PRIMARY KEY (`IDNO`),
  UNIQUE KEY `uk_user_info_username` (`USERNAME`),
  KEY `idx_user_info_branch` (`BRANCH_ID`),
  KEY `idx_user_info_permissions` (`PERMISSIONS`),
  KEY `idx_user_info_active` (`ACTIVE`),
  CONSTRAINT `fk_user_info_user_role` FOREIGN KEY (`PERMISSIONS`) REFERENCES `user_role` (`IDNo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Staff accounts';

-- ---------------------------------------------------------------------------
-- branch (office / site; referenced by user_info.BRANCH_ID and branch_sidebar_permissions)
-- ---------------------------------------------------------------------------
CREATE TABLE `branch` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(160) NOT NULL,
  `code` VARCHAR(32) NULL DEFAULT NULL,
  `ACTIVE` TINYINT(1) NOT NULL DEFAULT 1,
  `CREATED_DT` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_branch_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Branches / sites for sidebar and staff assignment';

-- ---------------------------------------------------------------------------
-- branch_sidebar_permissions
-- ---------------------------------------------------------------------------
CREATE TABLE `branch_sidebar_permissions` (
  `branch_id` INT UNSIGNED NOT NULL,
  `feature_key` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`branch_id`, `feature_key`),
  KEY `idx_bsp_branch` (`branch_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Control Panel sidebar features enabled per branch';

-- ---------------------------------------------------------------------------
-- user_role_crud_permissions (role_id = user_role.IDNo)
-- ---------------------------------------------------------------------------
CREATE TABLE `user_role_crud_permissions` (
  `role_id` INT UNSIGNED NOT NULL,
  `module_key` VARCHAR(64) NOT NULL,
  `can_create` TINYINT(1) NOT NULL DEFAULT 0,
  `can_update` TINYINT(1) NOT NULL DEFAULT 0,
  `can_delete` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`role_id`, `module_key`),
  KEY `idx_urcp_role` (`role_id`),
  CONSTRAINT `fk_urcp_user_role` FOREIGN KEY (`role_id`) REFERENCES `user_role` (`IDNo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Staff CRUD rights per module (Control Panel)';

-- ---------------------------------------------------------------------------
-- role_sidebar_permissions (which sidebar modules this role may see; ∩ branch)
-- ---------------------------------------------------------------------------
CREATE TABLE `role_sidebar_permissions` (
  `role_id` INT UNSIGNED NOT NULL,
  `feature_key` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`role_id`, `feature_key`),
  KEY `idx_rsp_role` (`role_id`),
  CONSTRAINT `fk_rsp_user_role` FOREIGN KEY (`role_id`) REFERENCES `user_role` (`IDNo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Sidebar feature allowlist per role; effective menu = branch ∩ role';

-- ---------------------------------------------------------------------------
-- area (CRM grouping by city/district)
-- ---------------------------------------------------------------------------
CREATE TABLE `area` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NULL DEFAULT NULL,
  `name` VARCHAR(120) NOT NULL,
  `city` VARCHAR(120) NULL DEFAULT NULL,
  `district` VARCHAR(120) NULL DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_area_branch_name` (`branch_id`, `name`),
  KEY `idx_area_city` (`city`),
  CONSTRAINT `fk_area_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Area categorization (Makati, BGC, Pasig, etc.)';

-- ---------------------------------------------------------------------------
-- property (building/project level with common/legal address split)
-- ---------------------------------------------------------------------------
CREATE TABLE `property` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NULL DEFAULT NULL,
  `area_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `property_code` VARCHAR(40) NULL DEFAULT NULL,
  `name` VARCHAR(180) NOT NULL,
  `common_address` VARCHAR(255) NOT NULL,
  `legal_address` VARCHAR(255) NOT NULL,
  `property_type` ENUM('condo','house','commercial','mixed_use','other') NOT NULL DEFAULT 'condo',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_property_code` (`property_code`),
  KEY `idx_property_branch_area` (`branch_id`, `area_id`),
  CONSTRAINT `fk_property_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_property_area` FOREIGN KEY (`area_id`) REFERENCES `area` (`id`),
  CONSTRAINT `fk_property_created_by` FOREIGN KEY (`created_by`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Building or project master data';

-- ---------------------------------------------------------------------------
-- unit (vacancy, pricing, categorization)
-- ---------------------------------------------------------------------------
CREATE TABLE `unit` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `property_id` BIGINT UNSIGNED NOT NULL,
  `unit_code` VARCHAR(60) NOT NULL,
  `building_no` VARCHAR(40) NULL DEFAULT NULL,
  `tower` VARCHAR(80) NULL DEFAULT NULL,
  `floor_no` VARCHAR(20) NULL DEFAULT NULL,
  `unit_no` VARCHAR(40) NOT NULL,
  `unit_type` VARCHAR(40) NOT NULL COMMENT 'Studio, 1BR, 2BR, Loft, etc.',
  `listing_type` ENUM('monthly_rental','selling','short_term_rental') NOT NULL DEFAULT 'monthly_rental',
  `monthly_rent` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `market_value` DECIMAL(14,2) NULL DEFAULT NULL,
  `status` ENUM('vacant','occupied','reserved','maintenance','inactive') NOT NULL DEFAULT 'vacant',
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_unit_property_unit_code` (`property_id`, `unit_code`),
  KEY `idx_unit_status` (`status`),
  KEY `idx_unit_listing_type` (`listing_type`),
  CONSTRAINT `fk_unit_property` FOREIGN KEY (`property_id`) REFERENCES `property` (`id`),
  CONSTRAINT `fk_unit_created_by` FOREIGN KEY (`created_by`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Unit inventory with vacancy and pricing';

-- ---------------------------------------------------------------------------
-- partner_agency (external broker/agency master list)
-- ---------------------------------------------------------------------------
CREATE TABLE `partner_agency` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NULL DEFAULT NULL,
  `agency_name` VARCHAR(180) NOT NULL,
  `contact_person` VARCHAR(140) NULL DEFAULT NULL,
  `contact_number` VARCHAR(40) NULL DEFAULT NULL,
  `email` VARCHAR(180) NULL DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_partner_agency_branch_name` (`branch_id`, `agency_name`),
  KEY `idx_partner_agency_branch` (`branch_id`),
  CONSTRAINT `fk_partner_agency_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Pre-registered external broker/agency directory';

-- ---------------------------------------------------------------------------
-- landlord_profile
-- ---------------------------------------------------------------------------
CREATE TABLE `landlord_profile` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NULL DEFAULT NULL,
  `full_name` VARCHAR(180) NOT NULL,
  `mobile_no` VARCHAR(40) NULL DEFAULT NULL,
  `email` VARCHAR(180) NULL DEFAULT NULL,
  `gov_id_no` VARCHAR(100) NULL DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_landlord_name` (`full_name`),
  KEY `idx_landlord_branch` (`branch_id`),
  CONSTRAINT `fk_landlord_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Landlord master records';

-- ---------------------------------------------------------------------------
-- tenant_profile
-- ---------------------------------------------------------------------------
CREATE TABLE `tenant_profile` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NULL DEFAULT NULL,
  `full_name` VARCHAR(180) NOT NULL,
  `email` VARCHAR(180) NULL DEFAULT NULL,
  `mobile_no` VARCHAR(40) NULL DEFAULT NULL,
  `nationality` VARCHAR(80) NULL DEFAULT NULL,
  `passport_no` VARCHAR(100) NULL DEFAULT NULL,
  `primary_id_no` VARCHAR(100) NULL DEFAULT NULL,
  `birth_date` DATE NULL DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_name` (`full_name`),
  KEY `idx_tenant_branch` (`branch_id`),
  CONSTRAINT `fk_tenant_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tenant master records (supports KYC fields)';

-- ---------------------------------------------------------------------------
-- lease_contract (new lease workflow backbone)
-- ---------------------------------------------------------------------------
CREATE TABLE `lease_contract` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NOT NULL,
  `contract_no` VARCHAR(60) NOT NULL,
  `unit_id` BIGINT UNSIGNED NOT NULL,
  `landlord_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `agent_id` INT UNSIGNED NULL DEFAULT NULL COMMENT 'Who closed deal',
  `partner_agency_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `contract_type` ENUM('monthly_rental','selling','short_term_rental') NOT NULL DEFAULT 'monthly_rental',
  `status` ENUM('draft','active','completed','terminated','cancelled') NOT NULL DEFAULT 'draft',
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `move_in_date` DATE NULL DEFAULT NULL,
  `move_out_date` DATE NULL DEFAULT NULL,
  `monthly_rent` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `security_deposit` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `advance_rent` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `manual_profit_override` DECIMAL(14,2) NULL DEFAULT NULL,
  `profit_override_note` VARCHAR(255) NULL DEFAULT NULL,
  `special_remarks` TEXT NULL,
  `created_by` INT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_contract_no` (`contract_no`),
  KEY `idx_lease_contract_branch` (`branch_id`),
  KEY `idx_lease_contract_status_dates` (`status`, `start_date`, `end_date`),
  KEY `idx_lease_contract_agent` (`agent_id`),
  CONSTRAINT `fk_contract_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_contract_unit` FOREIGN KEY (`unit_id`) REFERENCES `unit` (`id`),
  CONSTRAINT `fk_contract_landlord` FOREIGN KEY (`landlord_id`) REFERENCES `landlord_profile` (`id`),
  CONSTRAINT `fk_contract_agent` FOREIGN KEY (`agent_id`) REFERENCES `user_info` (`IDNO`),
  CONSTRAINT `fk_contract_partner_agency` FOREIGN KEY (`partner_agency_id`) REFERENCES `partner_agency` (`id`),
  CONSTRAINT `fk_contract_created_by` FOREIGN KEY (`created_by`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Contract lifecycle with deal attribution and financial defaults';

-- ---------------------------------------------------------------------------
-- contract_tenant (supports co-tenants + historical retention)
-- ---------------------------------------------------------------------------
CREATE TABLE `contract_tenant` (
  `contract_id` BIGINT UNSIGNED NOT NULL,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `is_primary` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`contract_id`, `tenant_id`),
  KEY `idx_contract_tenant_tenant` (`tenant_id`),
  CONSTRAINT `fk_ct_contract` FOREIGN KEY (`contract_id`) REFERENCES `lease_contract` (`id`),
  CONSTRAINT `fk_ct_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenant_profile` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Many-to-many mapping for tenants per contract';

-- ---------------------------------------------------------------------------
-- blacklist_record (tenant or landlord risk history)
-- ---------------------------------------------------------------------------
CREATE TABLE `blacklist_record` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NOT NULL,
  `entity_type` ENUM('tenant','landlord') NOT NULL,
  `tenant_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `landlord_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `reason` VARCHAR(255) NOT NULL,
  `details` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `tagged_by` INT UNSIGNED NULL DEFAULT NULL,
  `tagged_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_blacklist_branch` (`branch_id`),
  KEY `idx_blacklist_entity` (`entity_type`, `is_active`),
  CONSTRAINT `fk_blacklist_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_blacklist_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenant_profile` (`id`),
  CONSTRAINT `fk_blacklist_landlord` FOREIGN KEY (`landlord_id`) REFERENCES `landlord_profile` (`id`),
  CONSTRAINT `fk_blacklist_tagged_by` FOREIGN KEY (`tagged_by`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Blacklist registry with reason/history';

-- ---------------------------------------------------------------------------
-- document_template (standardized forms/templates storage)
-- ---------------------------------------------------------------------------
CREATE TABLE `document_template` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NULL DEFAULT NULL,
  `template_key` VARCHAR(80) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `version_no` INT UNSIGNED NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_doc_template_branch_key_version` (`branch_id`, `template_key`, `version_no`),
  KEY `idx_doc_template_branch` (`branch_id`),
  CONSTRAINT `fk_doc_template_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_doc_template_created_by` FOREIGN KEY (`created_by`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Template versions used for auto-generated docs';

-- ---------------------------------------------------------------------------
-- document_repository (searchable DMS records)
-- ---------------------------------------------------------------------------
CREATE TABLE `document_repository` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NOT NULL,
  `contract_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `tenant_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `uploaded_by` INT UNSIGNED NULL DEFAULT NULL,
  `doc_type` ENUM('lease_contract','invoice','kyc','receipt','move_in_out','other') NOT NULL DEFAULT 'other',
  `title` VARCHAR(180) NOT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `is_portal_visible` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doc_repo_branch` (`branch_id`),
  KEY `idx_doc_repo_contract` (`contract_id`),
  KEY `idx_doc_repo_tenant` (`tenant_id`),
  KEY `idx_doc_repo_doc_type` (`doc_type`),
  CONSTRAINT `fk_doc_repo_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_doc_repo_contract` FOREIGN KEY (`contract_id`) REFERENCES `lease_contract` (`id`),
  CONSTRAINT `fk_doc_repo_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenant_profile` (`id`),
  CONSTRAINT `fk_doc_repo_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Document Management System searchable repository';

-- ---------------------------------------------------------------------------
-- tenant_document (passport/ID update tracking for KYC)
-- ---------------------------------------------------------------------------
CREATE TABLE `tenant_document` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NOT NULL,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `document_type` ENUM('passport','national_id','visa','contract_attachment','other') NOT NULL DEFAULT 'other',
  `document_no` VARCHAR(120) NULL DEFAULT NULL,
  `expiry_date` DATE NULL DEFAULT NULL,
  `file_path` VARCHAR(255) NOT NULL,
  `verified_by` INT UNSIGNED NULL DEFAULT NULL,
  `verified_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_document_branch` (`branch_id`),
  KEY `idx_tenant_document_tenant` (`tenant_id`),
  CONSTRAINT `fk_tenant_document_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_tenant_document_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenant_profile` (`id`),
  CONSTRAINT `fk_tenant_document_verified_by` FOREIGN KEY (`verified_by`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='KYC document uploads and verification trail';

-- ---------------------------------------------------------------------------
-- invoice (auto-generated billing statement)
-- ---------------------------------------------------------------------------
CREATE TABLE `invoice` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NOT NULL,
  `invoice_no` VARCHAR(60) NOT NULL,
  `contract_id` BIGINT UNSIGNED NOT NULL,
  `billing_period_start` DATE NOT NULL,
  `billing_period_end` DATE NOT NULL,
  `due_date` DATE NOT NULL,
  `base_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `other_charges` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('draft','issued','partially_paid','paid','overdue','void') NOT NULL DEFAULT 'draft',
  `issued_at` DATETIME NULL DEFAULT NULL,
  `created_by` INT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invoice_no` (`invoice_no`),
  KEY `idx_invoice_branch` (`branch_id`),
  KEY `idx_invoice_contract_status` (`contract_id`, `status`),
  KEY `idx_invoice_due_date` (`due_date`),
  CONSTRAINT `fk_invoice_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_invoice_contract` FOREIGN KEY (`contract_id`) REFERENCES `lease_contract` (`id`),
  CONSTRAINT `fk_invoice_created_by` FOREIGN KEY (`created_by`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Billing statements generated from active contracts';

-- ---------------------------------------------------------------------------
-- payment_schedule (upcoming payments/overdue basis)
-- ---------------------------------------------------------------------------
CREATE TABLE `payment_schedule` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NOT NULL,
  `contract_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `due_date` DATE NOT NULL,
  `amount_due` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `status` ENUM('pending','partially_paid','paid','overdue','waived') NOT NULL DEFAULT 'pending',
  `notes` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_schedule_branch` (`branch_id`),
  KEY `idx_payment_schedule_contract_due` (`contract_id`, `due_date`),
  KEY `idx_payment_schedule_status_due` (`status`, `due_date`),
  CONSTRAINT `fk_payment_schedule_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_payment_schedule_contract` FOREIGN KEY (`contract_id`) REFERENCES `lease_contract` (`id`),
  CONSTRAINT `fk_payment_schedule_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoice` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Expected payment ledger lines per contract period';

-- ---------------------------------------------------------------------------
-- payment_transaction (actual collections)
-- ---------------------------------------------------------------------------
CREATE TABLE `payment_transaction` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NOT NULL,
  `payment_schedule_id` BIGINT UNSIGNED NOT NULL,
  `invoice_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `amount_paid` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `payment_date` DATE NOT NULL,
  `payment_method` ENUM('cash','bank_transfer','online','check','other') NOT NULL DEFAULT 'cash',
  `reference_no` VARCHAR(100) NULL DEFAULT NULL,
  `received_by` INT UNSIGNED NULL DEFAULT NULL,
  `remarks` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_txn_branch` (`branch_id`),
  KEY `idx_payment_txn_date` (`payment_date`),
  KEY `idx_payment_txn_schedule` (`payment_schedule_id`),
  CONSTRAINT `fk_payment_txn_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_payment_txn_schedule` FOREIGN KEY (`payment_schedule_id`) REFERENCES `payment_schedule` (`id`),
  CONSTRAINT `fk_payment_txn_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoice` (`id`),
  CONSTRAINT `fk_payment_txn_received_by` FOREIGN KEY (`received_by`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Recorded collections; drives paid color coding in calendar/UI';

-- ---------------------------------------------------------------------------
-- contract_collaboration (external broker terms/remarks history)
-- ---------------------------------------------------------------------------
CREATE TABLE `contract_collaboration` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NOT NULL,
  `contract_id` BIGINT UNSIGNED NOT NULL,
  `partner_agency_id` BIGINT UNSIGNED NOT NULL,
  `commission_terms` VARCHAR(255) NULL DEFAULT NULL,
  `remarks` TEXT NULL,
  `created_by` INT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_collab_branch` (`branch_id`),
  KEY `idx_collab_contract` (`contract_id`),
  CONSTRAINT `fk_collab_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_collab_contract` FOREIGN KEY (`contract_id`) REFERENCES `lease_contract` (`id`),
  CONSTRAINT `fk_collab_agency` FOREIGN KEY (`partner_agency_id`) REFERENCES `partner_agency` (`id`),
  CONSTRAINT `fk_collab_created_by` FOREIGN KEY (`created_by`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Broker/agency collaboration logs per contract';

-- ---------------------------------------------------------------------------
-- special_request (tenant needs or landlord instructions)
-- ---------------------------------------------------------------------------
CREATE TABLE `special_request` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NOT NULL,
  `contract_id` BIGINT UNSIGNED NOT NULL,
  `request_source` ENUM('tenant','landlord','internal') NOT NULL DEFAULT 'tenant',
  `title` VARCHAR(180) NOT NULL,
  `details` TEXT NOT NULL,
  `status` ENUM('open','in_progress','resolved','cancelled') NOT NULL DEFAULT 'open',
  `created_by` INT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_special_request_branch` (`branch_id`),
  KEY `idx_special_request_contract_status` (`contract_id`, `status`),
  CONSTRAINT `fk_special_request_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_special_request_contract` FOREIGN KEY (`contract_id`) REFERENCES `lease_contract` (`id`),
  CONSTRAINT `fk_special_request_created_by` FOREIGN KEY (`created_by`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Operational special requests and remarks tracker';

-- ---------------------------------------------------------------------------
-- inventory_snapshot (move-in/out inspection header)
-- ---------------------------------------------------------------------------
CREATE TABLE `inventory_snapshot` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NOT NULL,
  `contract_id` BIGINT UNSIGNED NOT NULL,
  `snapshot_type` ENUM('move_in','move_out','routine') NOT NULL DEFAULT 'move_in',
  `inspection_date` DATE NOT NULL,
  `inspected_by` INT UNSIGNED NULL DEFAULT NULL,
  `remarks` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_snapshot_branch` (`branch_id`),
  KEY `idx_inventory_snapshot_contract_type` (`contract_id`, `snapshot_type`),
  CONSTRAINT `fk_inventory_snapshot_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_inventory_snapshot_contract` FOREIGN KEY (`contract_id`) REFERENCES `lease_contract` (`id`),
  CONSTRAINT `fk_inventory_snapshot_inspected_by` FOREIGN KEY (`inspected_by`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Inventory inspection snapshot per contract lifecycle event';

-- ---------------------------------------------------------------------------
-- inventory_snapshot_item (furniture/appliance/item details)
-- ---------------------------------------------------------------------------
CREATE TABLE `inventory_snapshot_item` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `snapshot_id` BIGINT UNSIGNED NOT NULL,
  `item_name` VARCHAR(180) NOT NULL,
  `category` VARCHAR(80) NULL DEFAULT NULL,
  `quantity` INT UNSIGNED NOT NULL DEFAULT 1,
  `condition_state` ENUM('excellent','good','fair','damaged','missing') NOT NULL DEFAULT 'good',
  `notes` VARCHAR(255) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inventory_item_snapshot` (`snapshot_id`),
  CONSTRAINT `fk_inventory_item_snapshot` FOREIGN KEY (`snapshot_id`) REFERENCES `inventory_snapshot` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Detailed inventory list items for move-in/out';

-- ---------------------------------------------------------------------------
-- calendar_event (interactive schedule: move-ins/outs/payments)
-- ---------------------------------------------------------------------------
CREATE TABLE `calendar_event` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NOT NULL,
  `contract_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `payment_schedule_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `event_type` ENUM('move_in','move_out','payment_due','payment_received','inspection','other') NOT NULL,
  `event_date` DATE NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `color_code` VARCHAR(20) NULL DEFAULT NULL COMMENT 'Use app constants, e.g. #16a34a for paid',
  `metadata_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_calendar_event_branch` (`branch_id`),
  KEY `idx_calendar_event_date_type` (`event_date`, `event_type`),
  CONSTRAINT `fk_calendar_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_calendar_contract` FOREIGN KEY (`contract_id`) REFERENCES `lease_contract` (`id`),
  CONSTRAINT `fk_calendar_payment_schedule` FOREIGN KEY (`payment_schedule_id`) REFERENCES `payment_schedule` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Calendar feed for operations and payment statuses';

-- ---------------------------------------------------------------------------
-- audit_log (manual overrides + sensitive action trace)
-- ---------------------------------------------------------------------------
CREATE TABLE `audit_log` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NULL DEFAULT NULL,
  `actor_user_id` INT UNSIGNED NULL DEFAULT NULL,
  `module_name` VARCHAR(80) NOT NULL,
  `record_table` VARCHAR(80) NOT NULL,
  `record_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `action` ENUM('create','update','delete','status_change','override','login') NOT NULL,
  `change_summary` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_branch` (`branch_id`),
  KEY `idx_audit_module_date` (`module_name`, `created_at`),
  CONSTRAINT `fk_audit_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_audit_actor_user` FOREIGN KEY (`actor_user_id`) REFERENCES `user_info` (`IDNO`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Generic audit trail for compliance and accountability';

-- ---------------------------------------------------------------------------
-- Seed: user_role — real estate roles (IDs fixed for FK seeds)
-- ---------------------------------------------------------------------------
INSERT INTO `user_role` (`IDNo`, `ROLE`, `ENCODED_BY`, `ENCODED_DT`, `EDITED_BY`, `EDITED_DT`, `ACTIVE`) VALUES
  (1, 'Administrator', NULL, NOW(), NULL, NULL, 1),
  (2, 'Property Manager', NULL, NOW(), NULL, NULL, 1),
  (3, 'Leasing Agent', NULL, NOW(), NULL, NULL, 1),
  (4, 'Finance Officer', NULL, NOW(), NULL, NULL, 1),
  (5, 'Read Only', NULL, NOW(), NULL, NULL, 1);

-- ---------------------------------------------------------------------------
-- Seed: user_info — default admin (password: admin123, bcrypt)
-- ---------------------------------------------------------------------------
INSERT INTO `user_info` (
  `IDNO`, `FIRSTNAME`, `LASTNAME`, `USERNAME`, `PASSWORD`, `SALT`,
  `PERMISSIONS`, `LAST_LOGIN`, `ENCODED_BY`, `ENCODED_DT`, `EDITED_BY`, `EDITED_DT`, `ACTIVE`, `BRANCH_ID`
) VALUES (
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
);

-- Optional sample user: Property Manager (same branch)
INSERT INTO `user_info` (
  `IDNO`, `FIRSTNAME`, `LASTNAME`, `USERNAME`, `PASSWORD`, `SALT`,
  `PERMISSIONS`, `LAST_LOGIN`, `ENCODED_BY`, `ENCODED_DT`, `EDITED_BY`, `EDITED_DT`, `ACTIVE`, `BRANCH_ID`
) VALUES (
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
);

-- Fix audit: first user encoded system roles (optional)
UPDATE `user_role` SET `ENCODED_BY` = 1 WHERE `IDNo` IN (1, 2, 3, 4, 5);

-- ---------------------------------------------------------------------------
-- Seed: branches
-- ---------------------------------------------------------------------------
INSERT INTO `branch` (`id`, `name`, `code`, `ACTIVE`) VALUES
  (1, 'Main Office', 'BR001', 1),
  (2, 'North Annex', 'BR002', 1);

-- ---------------------------------------------------------------------------
-- Seed: branch sidebar — all modules (branch 1 + sample branch 2)
-- ---------------------------------------------------------------------------
INSERT INTO `branch_sidebar_permissions` (`branch_id`, `feature_key`) VALUES
  (1, 'dashboard'),
  (1, 'units'),
  (1, 'contracts'),
  (1, 'crm'),
  (1, 'ledger'),
  (1, 'calendar'),
  (1, 'tenant_portal'),
  (1, 'agent_portal'),
  (2, 'dashboard'),
  (2, 'units'),
  (2, 'contracts'),
  (2, 'crm'),
  (2, 'ledger'),
  (2, 'calendar'),
  (2, 'tenant_portal'),
  (2, 'agent_portal');

-- ---------------------------------------------------------------------------
-- Seed: role sidebar — all roles may see all modules by default (admin narrows later)
-- ---------------------------------------------------------------------------
INSERT INTO `role_sidebar_permissions` (`role_id`, `feature_key`) VALUES
  (1, 'dashboard'), (1, 'units'), (1, 'contracts'), (1, 'crm'), (1, 'ledger'), (1, 'calendar'), (1, 'tenant_portal'), (1, 'agent_portal'),
  (2, 'dashboard'), (2, 'units'), (2, 'contracts'), (2, 'crm'), (2, 'ledger'), (2, 'calendar'), (2, 'tenant_portal'), (2, 'agent_portal'),
  (3, 'dashboard'), (3, 'units'), (3, 'contracts'), (3, 'crm'), (3, 'ledger'), (3, 'calendar'), (3, 'tenant_portal'), (3, 'agent_portal'),
  (4, 'dashboard'), (4, 'units'), (4, 'contracts'), (4, 'crm'), (4, 'ledger'), (4, 'calendar'), (4, 'tenant_portal'), (4, 'agent_portal'),
  (5, 'dashboard'), (5, 'units'), (5, 'contracts'), (5, 'crm'), (5, 'ledger'), (5, 'calendar'), (5, 'tenant_portal'), (5, 'agent_portal');

-- ---------------------------------------------------------------------------
-- Seed: CRUD per role (module_key matches branch_sidebar + staff modules)
-- Role 1–2: full staff access (ledger: no delete)
-- Role 3 Leasing: no delete on units/contracts/crm
-- Role 4 Finance: ledger + calendar; mostly read elsewhere
-- Role 5: no create/update/delete (portal to branch sidebar still via branch table)
-- ---------------------------------------------------------------------------
INSERT INTO `user_role_crud_permissions`
  (`role_id`, `module_key`, `can_create`, `can_update`, `can_delete`) VALUES
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
  (5, 'agent_portal',    0, 0, 0);

-- If you already imported an older seed and login returns 401, update bcrypt hashes:
-- UPDATE user_info SET PASSWORD = '$2b$10$talkLtFUrgOrZ52YqMGyEutyF.jOcHNI64s1HlV0ONl6Nh.x7eIH.'
--   WHERE USERNAME IN ('admin', 'manager1');
