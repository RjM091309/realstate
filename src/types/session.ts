export interface RegisterInput {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  roleId: number;
}

export interface SessionPayload {
  user: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    /** Public URL path e.g. `/uploads/avatars/….webp` */
    avatarUrl?: string | null;
  };
  role: { id: number; name: string };
  branchId: number;
  sidebarTabIds: string[];
  crud: Record<string, { create: boolean; update: boolean; delete: boolean }>;
}
