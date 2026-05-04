import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../jwt.js';
import { loadSessionPayload } from '../services/sessionService.js';
import { finalizeProfileAvatarUpload, deletePublicAvatarFile } from '../services/avatarUploadService.js';
import {
  createUserAccount,
  findUserById,
  findUserByUsername,
  findUserRowById,
  getActiveRoleById,
  getBranchByIdActive,
  getFirstActiveBranchId,
  getStaffUserJoined,
  getUserAvatarUrl,
  listActiveRoles,
  listBranchesActive,
  listStaffUsersJoined,
  setUserAvatarByUserId,
  updateUserAvatarUrl,
  updateUserPasswordById,
  updateUserPasswordHash,
  updateUserProfile,
  updateUserStaffFields,
  usernameExists,
  usernameTakenByOther,
} from '../models/authModel.js';

/** Minimum length for new passwords (register, staff user, change password). */
const MIN_PASSWORD_LENGTH = 4;

async function sendTokenAndSession(res, userId, opts) {
  const status = opts?.status ?? 200;
  const sessionError = opts?.sessionError ?? 'Could not load session';
  const payload = { userId };
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(500).json({ error: sessionError });
    return;
  }
  const body = { token, session };
  if (status === 201) res.status(201).json(body);
  else res.json(body);
}

export async function getRoles(_req, res) {
  try {
    const rows = await listActiveRoles();
    res.json({
      roles: rows.map((r) => ({
        id: Number(r.IDNo),
        name: String(r.ROLE ?? ''),
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load roles' });
  }
}

export async function register(req, res) {
  try {
    const firstName = String(req.body?.firstName ?? '').trim();
    const lastName = String(req.body?.lastName ?? '').trim();
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    const roleId = Number(req.body?.roleId);

    if (!firstName || !lastName || !username || !password) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    if (!Number.isFinite(roleId) || roleId < 1) {
      res.status(400).json({ error: 'Choose a valid role' });
      return;
    }
    if (firstName.length > 128 || lastName.length > 128) {
      res.status(400).json({ error: 'Name fields are too long' });
      return;
    }
    if (username.length < 3 || username.length > 64) {
      res.status(400).json({ error: 'Username must be between 3 and 64 characters' });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
      return;
    }

    const role = await getActiveRoleById(roleId);
    if (!role) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const dup = await usernameExists(username);
    if (dup) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const branchId = await getFirstActiveBranchId();
    const hash = await bcrypt.hash(password, 10);
    const userId = await createUserAccount({
      firstName,
      lastName,
      username,
      passwordHash: hash,
      roleId,
      branchId,
    });
    if (!Number.isFinite(userId) || userId < 1) {
      res.status(500).json({ error: 'Registration failed' });
      return;
    }

    await sendTokenAndSession(res, userId, {
      status: 201,
      sessionError: 'Account created but session could not be loaded',
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
}

export async function login(req, res) {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!username || !password) {
      res.status(400).json({ error: 'Missing username or password' });
      return;
    }

    const row = await findUserByUsername(username);
    if (!row || row.ACTIVE !== 1) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const ok = await bcrypt.compare(password, String(row.PASSWORD ?? ''));
    if (!ok) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const userId = Number(row.IDNO);
    await sendTokenAndSession(res, userId);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
}

export async function getSession(req, res) {
  try {
    const auth = req.headers.authorization;
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }

    const session = await loadSessionPayload(decoded.userId);
    if (!session) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.json({ session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Session failed' });
  }
}

export function logout(_req, res) {
  res.json({ ok: true });
}

export async function uploadProfilePhoto(req, res) {
  try {
    const userId = Number(req.userId);
    if (!Number.isFinite(userId) || userId < 1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const row = await findUserById(userId);
    if (!row || row.ACTIVE !== 1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const oldUrl = await getUserAvatarUrl(userId);
    let publicUrl;
    try {
      ({ publicUrl } = await finalizeProfileAvatarUpload(req.file));
    } catch (e) {
      const status = e?.statusCode === 400 ? 400 : 500;
      const msg =
        status === 400 && e instanceof Error ? e.message : 'Could not process image';
      res.status(status).json({ error: msg });
      return;
    }

    await deletePublicAvatarFile(oldUrl);
    await updateUserAvatarUrl(userId, publicUrl);

    const session = await loadSessionPayload(userId);
    if (!session) {
      res.status(500).json({ error: 'Could not load session' });
      return;
    }
    res.json({ session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not upload photo' });
  }
}

export async function deleteProfilePhoto(req, res) {
  try {
    const userId = Number(req.userId);
    if (!Number.isFinite(userId) || userId < 1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const row = await findUserById(userId);
    if (!row || row.ACTIVE !== 1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const oldUrl = await getUserAvatarUrl(userId);
    await deletePublicAvatarFile(oldUrl);
    await updateUserAvatarUrl(userId, null);

    const session = await loadSessionPayload(userId);
    if (!session) {
      res.status(500).json({ error: 'Could not load session' });
      return;
    }
    res.json({ session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not remove photo' });
  }
}

export async function uploadStaffUserPhoto(req, res) {
  try {
    const targetId = Number(req.params.userId);
    if (!Number.isFinite(targetId) || targetId < 1) {
      res.status(400).json({ error: 'Invalid user' });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const existing = await findUserRowById(targetId);
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const oldRaw = existing.AVATAR_URL;
    const oldUrl =
      oldRaw != null && String(oldRaw).trim() !== '' ? String(oldRaw) : null;

    let publicUrl;
    try {
      ({ publicUrl } = await finalizeProfileAvatarUpload(req.file));
    } catch (e) {
      const status = e?.statusCode === 400 ? 400 : 500;
      const msg =
        status === 400 && e instanceof Error ? e.message : 'Could not process image';
      res.status(status).json({ error: msg });
      return;
    }

    await deletePublicAvatarFile(oldUrl);
    await setUserAvatarByUserId(targetId, publicUrl);

    const row = await getStaffUserJoined(targetId);
    res.json({ user: row ? mapStaffUserRow(row) : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not upload photo' });
  }
}

export async function deleteStaffUserPhoto(req, res) {
  try {
    const targetId = Number(req.params.userId);
    if (!Number.isFinite(targetId) || targetId < 1) {
      res.status(400).json({ error: 'Invalid user' });
      return;
    }

    const existing = await findUserRowById(targetId);
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const oldRaw = existing.AVATAR_URL;
    const oldUrl =
      oldRaw != null && String(oldRaw).trim() !== '' ? String(oldRaw) : null;
    await deletePublicAvatarFile(oldUrl);
    await setUserAvatarByUserId(targetId, null);

    const row = await getStaffUserJoined(targetId);
    res.json({ user: row ? mapStaffUserRow(row) : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not remove photo' });
  }
}

export async function updateProfile(req, res) {
  try {
    const userId = Number(req.userId);
    if (!Number.isFinite(userId) || userId < 1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const firstName = String(req.body?.firstName ?? '').trim();
    const lastName = String(req.body?.lastName ?? '').trim();
    if (!firstName || !lastName) {
      res.status(400).json({ error: 'First and last name are required' });
      return;
    }
    if (firstName.length > 128 || lastName.length > 128) {
      res.status(400).json({ error: 'Name fields are too long' });
      return;
    }

    const row = await findUserById(userId);
    if (!row || row.ACTIVE !== 1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await updateUserProfile(userId, { firstName, lastName });
    const session = await loadSessionPayload(userId);
    if (!session) {
      res.status(500).json({ error: 'Could not load session' });
      return;
    }
    res.json({ session });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not update profile' });
  }
}

export async function changePassword(req, res) {
  try {
    const userId = Number(req.userId);
    if (!Number.isFinite(userId) || userId < 1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new password are required' });
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
      return;
    }

    const row = await findUserById(userId);
    if (!row || row.ACTIVE !== 1) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const ok = await bcrypt.compare(currentPassword, String(row.PASSWORD ?? ''));
    if (!ok) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await updateUserPasswordHash(userId, hash);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not update password' });
  }
}

function mapStaffUserRow(r) {
  const rawAvatar = r.AVATAR_URL;
  return {
    id: Number(r.IDNO),
    firstName: String(r.FIRSTNAME ?? ''),
    lastName: String(r.LASTNAME ?? ''),
    username: String(r.USERNAME ?? ''),
    roleId: Number(r.PERMISSIONS),
    roleName: String(r.roleName ?? ''),
    branchId: r.BRANCH_ID == null ? null : Number(r.BRANCH_ID),
    branchName: r.branchName != null ? String(r.branchName) : null,
    active: Boolean(Number(r.ACTIVE)),
    avatarUrl:
      rawAvatar != null && String(rawAvatar).trim() !== '' ? String(rawAvatar) : null,
  };
}

export async function listStaffBranches(_req, res) {
  try {
    const rows = await listBranchesActive();
    res.json({
      branches: rows.map((b) => ({
        id: Number(b.id),
        name: String(b.name ?? ''),
        code: b.code != null ? String(b.code) : null,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load branches' });
  }
}

export async function listStaffUsers(_req, res) {
  try {
    const rows = await listStaffUsersJoined();
    res.json({ users: rows.map(mapStaffUserRow) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load users' });
  }
}

export async function createStaffUser(req, res) {
  try {
    const firstName = String(req.body?.firstName ?? '').trim();
    const lastName = String(req.body?.lastName ?? '').trim();
    const username = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    const roleId = Number(req.body?.roleId);

    if (!firstName || !lastName || !username || !password) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    if (!Number.isFinite(roleId) || roleId < 1) {
      res.status(400).json({ error: 'Choose a valid role' });
      return;
    }
    if (firstName.length > 128 || lastName.length > 128) {
      res.status(400).json({ error: 'Name fields are too long' });
      return;
    }
    if (username.length < 3 || username.length > 64) {
      res.status(400).json({ error: 'Username must be between 3 and 64 characters' });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
      return;
    }

    const role = await getActiveRoleById(roleId);
    if (!role) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const dup = await usernameExists(username);
    if (dup) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    let branchId = null;
    const rawBr = req.body?.branchId;
    if (rawBr != null && String(rawBr).trim() !== '') {
      const n = Number(rawBr);
      if (!Number.isFinite(n) || n < 1) {
        res.status(400).json({ error: 'Invalid branch' });
        return;
      }
      const b = await getBranchByIdActive(n);
      if (!b) {
        res.status(400).json({ error: 'Invalid branch' });
        return;
      }
      branchId = n;
    }

    const hash = await bcrypt.hash(password, 10);
    const userId = await createUserAccount({
      firstName,
      lastName,
      username,
      passwordHash: hash,
      roleId,
      branchId,
    });
    if (!Number.isFinite(userId) || userId < 1) {
      res.status(500).json({ error: 'Could not create user' });
      return;
    }

    const row = await getStaffUserJoined(userId);
    if (!row) {
      res.status(201).json({
        user: { id: userId, firstName, lastName, username, roleId, active: true, avatarUrl: null },
      });
      return;
    }
    res.status(201).json({ user: mapStaffUserRow(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not create user' });
  }
}

export async function updateStaffUser(req, res) {
  try {
    const targetId = Number(req.params.userId);
    if (!Number.isFinite(targetId) || targetId < 1) {
      res.status(400).json({ error: 'Invalid user' });
      return;
    }

    const existing = await findUserRowById(targetId);
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const firstName =
      req.body?.firstName != null ? String(req.body.firstName).trim() : String(existing.FIRSTNAME ?? '');
    const lastName =
      req.body?.lastName != null ? String(req.body.lastName).trim() : String(existing.LASTNAME ?? '');
    const username =
      req.body?.username != null ? String(req.body.username).trim() : String(existing.USERNAME ?? '');
    const roleId =
      req.body?.roleId != null ? Number(req.body.roleId) : Number(existing.PERMISSIONS);
    const password = req.body?.password != null ? String(req.body.password) : '';

    if (!firstName || !lastName || !username) {
      res.status(400).json({ error: 'First name, last name, and username are required' });
      return;
    }
    if (username.length < 3 || username.length > 64) {
      res.status(400).json({ error: 'Username must be between 3 and 64 characters' });
      return;
    }
    if (!Number.isFinite(roleId) || roleId < 1) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    const role = await getActiveRoleById(roleId);
    if (!role) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }

    const taken = await usernameTakenByOther(username, targetId);
    if (taken) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    let activeNext;
    if (req.body?.active !== undefined) {
      if (typeof req.body.active !== 'boolean') {
        res.status(400).json({ error: 'active must be a boolean' });
        return;
      }
      if (req.body.active === false && targetId === Number(req.userId)) {
        res.status(400).json({ error: 'You cannot deactivate your own account' });
        return;
      }
      activeNext = req.body.active;
    }

    let branchId = existing.BRANCH_ID == null ? null : Number(existing.BRANCH_ID);
    if (req.body?.branchId !== undefined) {
      const rawBr = req.body.branchId;
      if (rawBr == null || String(rawBr).trim() === '') {
        branchId = null;
      } else {
        const n = Number(rawBr);
        if (!Number.isFinite(n) || n < 1) {
          res.status(400).json({ error: 'Invalid branch' });
          return;
        }
        const b = await getBranchByIdActive(n);
        if (!b) {
          res.status(400).json({ error: 'Invalid branch' });
          return;
        }
        branchId = n;
      }
    }

    await updateUserStaffFields(targetId, {
      firstName,
      lastName,
      username,
      roleId,
      branchId,
      ...(activeNext !== undefined ? { active: activeNext } : {}),
    });

    if (password) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        res.status(400).json({
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        });
        return;
      }
      const hash = await bcrypt.hash(password, 10);
      await updateUserPasswordById(targetId, hash);
    }

    const row = await getStaffUserJoined(targetId);
    res.json({ user: row ? mapStaffUserRow(row) : null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not update user' });
  }
}

export async function deactivateStaffUser(req, res) {
  try {
    const targetId = Number(req.params.userId);
    const actorId = Number(req.userId);
    if (!Number.isFinite(targetId) || targetId < 1) {
      res.status(400).json({ error: 'Invalid user' });
      return;
    }
    if (targetId === actorId) {
      res.status(400).json({ error: 'You cannot deactivate your own account' });
      return;
    }
    const existing = await findUserRowById(targetId);
    if (!existing) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    await updateUserStaffFields(targetId, { active: false });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not deactivate user' });
  }
}
