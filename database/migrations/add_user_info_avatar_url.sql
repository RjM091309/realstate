-- Optional manual migration if ensureSchema has not run yet.
-- Adds staff profile photo URL (relative path served under /uploads/avatars/).

ALTER TABLE `user_info`
  ADD COLUMN `AVATAR_URL` VARCHAR(512) NULL DEFAULT NULL AFTER `BRANCH_ID`;
