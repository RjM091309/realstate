let io = null;

export function setIO(nextIO) {
  io = nextIO;
}

export function emitBranchNotificationsChanged(branchId) {
  if (!io) return;
  io.to(`branch:${Number(branchId)}`).emit('notifications:changed', { branchId: Number(branchId) });
}

