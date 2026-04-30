let io = null;

export function setIO(nextIO) {
  io = nextIO;
}

export function emitBranchNotificationsChanged(branchId) {
  if (!io) return;
  io.to(`branch:${Number(branchId)}`).emit('notifications:changed', { branchId: Number(branchId) });
}

export function emitRoleAccessChanged(roleId) {
  if (!io) return;
  const payload = { roleId: Number(roleId) };
  io.to(`role:${Number(roleId)}`).emit('access:changed', payload);
  io.emit('access:changed', payload);
}

