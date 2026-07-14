import {
  checkBlacklistMatch,
  getTenantContactForBlacklistCheck,
} from '../models/blacklistModel.js';

/**
 * Returns true when the party is allowed to proceed; sends 403 when blocked.
 */
export async function assertNotBlacklisted(res, branchId, { email, phone, governmentId } = {}) {
  const match = await checkBlacklistMatch(branchId, { email, phone, governmentId });
  if (!match) return true;

  res.status(403).json({
    error: 'This party is on the blacklist and cannot proceed.',
    code: 'BLACKLISTED',
    blacklist: {
      id: String(match.id),
      entityType: match.entity_type,
      name: match.name,
      reason: match.reason,
    },
  });
  return false;
}

export async function assertTenantNotBlacklisted(res, branchId, tenantId) {
  const contact = await getTenantContactForBlacklistCheck(branchId, tenantId);
  if (!contact) return true;
  return assertNotBlacklisted(res, branchId, {
    email: contact.email,
    phone: contact.phone,
    governmentId: contact.government_id,
  });
}

/** Convenience export for other modules (onboarding, lease checks). */
export async function checkBlacklist(branchId, { email, phone, governmentId } = {}) {
  const match = await checkBlacklistMatch(branchId, { email, phone, governmentId });
  if (!match) return { blocked: false, match: null };
  return {
    blocked: true,
    match: {
      id: String(match.id),
      entityType: match.entity_type,
      name: match.name,
      email: match.email,
      phone: match.phone,
      governmentId: match.government_id,
      reason: match.reason,
      createdAt: match.created_at,
    },
  };
}
