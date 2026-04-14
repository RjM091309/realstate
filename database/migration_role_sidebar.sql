-- Optional: the API also applies this on startup (server/ensureSchema.ts).
-- Manual: mysql -u root -p realstate < database/migration_role_sidebar.sql

CREATE TABLE IF NOT EXISTS `role_sidebar_permissions` (
  `role_id` INT UNSIGNED NOT NULL,
  `feature_key` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`role_id`, `feature_key`),
  KEY `idx_rsp_role` (`role_id`),
  CONSTRAINT `fk_rsp_user_role` FOREIGN KEY (`role_id`) REFERENCES `user_role` (`IDNo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `role_sidebar_permissions` (`role_id`, `feature_key`) VALUES
  (1, 'dashboard'), (1, 'units'), (1, 'contracts'), (1, 'crm'), (1, 'ledger'), (1, 'calendar'), (1, 'tenant_portal'), (1, 'agent_portal'),
  (2, 'dashboard'), (2, 'units'), (2, 'contracts'), (2, 'crm'), (2, 'ledger'), (2, 'calendar'), (2, 'tenant_portal'), (2, 'agent_portal'),
  (3, 'dashboard'), (3, 'units'), (3, 'contracts'), (3, 'crm'), (3, 'ledger'), (3, 'calendar'), (3, 'tenant_portal'), (3, 'agent_portal'),
  (4, 'dashboard'), (4, 'units'), (4, 'contracts'), (4, 'crm'), (4, 'ledger'), (4, 'calendar'), (4, 'tenant_portal'), (4, 'agent_portal'),
  (5, 'dashboard'), (5, 'units'), (5, 'contracts'), (5, 'crm'), (5, 'ledger'), (5, 'calendar'), (5, 'tenant_portal'), (5, 'agent_portal');
