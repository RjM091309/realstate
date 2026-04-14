export interface SessionPayload {
  user: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
  };
  role: { id: number; name: string };
  branchId: number;
  sidebarTabIds: string[];
  crud: Record<string, { create: boolean; update: boolean; delete: boolean }>;
}
