export function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set (min 16 characters) in production');
  }
  return 'realstate-dev-jwt-secret';
}

export interface JwtPayload {
  userId: number;
}
