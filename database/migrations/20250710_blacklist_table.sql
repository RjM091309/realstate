-- Blacklist registry for CRM (tenant / broker restricted parties)
-- Run automatically via server/ensureSchema.js on API boot; use this script for manual DBA runs.

CREATE TABLE IF NOT EXISTS `blacklist` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `branch_id` INT UNSIGNED NOT NULL,
  `entity_type` ENUM('tenant','broker') NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NULL DEFAULT NULL,
  `phone` VARCHAR(64) NULL DEFAULT NULL,
  `government_id` VARCHAR(128) NULL DEFAULT NULL,
  `reason` TEXT NOT NULL,
  `blacklisted_by` INT UNSIGNED NULL DEFAULT NULL,
  `tenant_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `partner_agency_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_blacklist_branch_active` (`branch_id`, `is_active`),
  KEY `idx_blacklist_entity` (`entity_type`, `is_active`),
  KEY `idx_blacklist_email` (`email`),
  KEY `idx_blacklist_phone` (`phone`),
  KEY `idx_blacklist_government_id` (`government_id`),
  KEY `idx_blacklist_tenant` (`tenant_id`),
  KEY `idx_blacklist_partner` (`partner_agency_id`),
  CONSTRAINT `fk_blacklist_v2_branch` FOREIGN KEY (`branch_id`) REFERENCES `branch` (`id`),
  CONSTRAINT `fk_blacklist_v2_by` FOREIGN KEY (`blacklisted_by`) REFERENCES `user_info` (`IDNO`),
  CONSTRAINT `fk_blacklist_v2_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenant_profile` (`id`),
  CONSTRAINT `fk_blacklist_v2_partner` FOREIGN KEY (`partner_agency_id`) REFERENCES `partner_agency` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
