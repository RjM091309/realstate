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
  `TABLE_ID` INT UNSIGNED NULL DEFAULT NULL COMMENT 'Optional legacy / linking id',
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
  `IDNO`, `TABLE_ID`, `FIRSTNAME`, `LASTNAME`, `USERNAME`, `PASSWORD`, `SALT`,
  `PERMISSIONS`, `LAST_LOGIN`, `ENCODED_BY`, `ENCODED_DT`, `EDITED_BY`, `EDITED_DT`, `ACTIVE`, `BRANCH_ID`
) VALUES (
  1,
  NULL,
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
  `IDNO`, `TABLE_ID`, `FIRSTNAME`, `LASTNAME`, `USERNAME`, `PASSWORD`, `SALT`,
  `PERMISSIONS`, `LAST_LOGIN`, `ENCODED_BY`, `ENCODED_DT`, `EDITED_BY`, `EDITED_DT`, `ACTIVE`, `BRANCH_ID`
) VALUES (
  2,
  NULL,
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
