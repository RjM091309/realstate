-- One-time migration: remove legacy TABLE_ID from user_info (unused; always NULL).
-- Run in phpMyAdmin SQL tab or: mysql -u root -p realstate < database/migrations/drop_user_info_table_id.sql

USE `realstate`;

ALTER TABLE `user_info` DROP COLUMN `TABLE_ID`;
