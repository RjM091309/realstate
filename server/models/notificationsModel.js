import { pool } from '../config/db.js';

export async function getUserBranchId(userId) {
  const [rows] = await pool.query(
    'SELECT BRANCH_ID FROM user_info WHERE IDNO = ? AND ACTIVE = 1 LIMIT 1',
    [userId],
  );
  const bid = rows[0]?.BRANCH_ID;
  return bid != null ? Number(bid) : 1;
}

export async function listNotificationsForUser(userId, branchId, limit) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Number(limit))) : 40;
  const [rows] = await pool.query(
    `
    SELECT
      f.notification_key AS id,
      f.title AS title,
      f.message AS message,
      f.created_at AS created_at,
      f.type AS type,
      CASE WHEN nr.read_at IS NULL THEN 1 ELSE 0 END AS unread
    FROM notification_feed f
    LEFT JOIN notification_read nr
      ON nr.user_id = ? AND nr.notification_key = f.notification_key
    WHERE f.branch_id = ?
    ORDER BY f.created_at DESC
    LIMIT ?
    `,
    [userId, branchId, safeLimit],
  );
  return rows;
}

export async function markAllNotificationsRead(userId, branchId) {
  await pool.query(
    `
    INSERT INTO notification_read (user_id, notification_key, read_at)
    SELECT ?, f.notification_key, NOW()
    FROM notification_feed f
    WHERE f.branch_id = ?
    ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)
    `,
    [userId, branchId],
  );
  return true;
}

export async function markNotificationRead(userId, notificationKey) {
  if (!notificationKey) return false;
  await pool.query(
    `
    INSERT INTO notification_read (user_id, notification_key, read_at)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE read_at = VALUES(read_at)
    `,
    [userId, notificationKey],
  );
  return true;
}

