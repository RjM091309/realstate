-- Optional: the API also runs this on startup (server/ensureSchema.ts).
-- Use this file only if you prefer manual SQL: mysql -u root -p realstate < database/migration_add_branch.sql

CREATE TABLE IF NOT EXISTS `branch` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(160) NOT NULL,
  `code` VARCHAR(32) NULL DEFAULT NULL,
  `ACTIVE` TINYINT(1) NOT NULL DEFAULT 1,
  `CREATED_DT` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_branch_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `branch` (`id`, `name`, `code`, `ACTIVE`) VALUES
  (1, 'Main Office', 'BR001', 1),
  (2, 'North Annex', 'BR002', 1);
