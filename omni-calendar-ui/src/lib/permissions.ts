import type { User } from "../types";

interface PermissionContext {
  user: User | null;
  isAdmin: boolean;
  isManager: boolean;
  isReadOnly: boolean;
}

export function canAddToColumn(
  ctx: PermissionContext,
  role: "SIAE" | "ENG"
): boolean {
  const { user, isAdmin, isReadOnly } = ctx;
  if (!user) return false;
  if (isAdmin || user.is_superuser || user.role === "CR") return true;
  return !isReadOnly && user.role === role;
}

export function canEditAssignment(ctx: PermissionContext): boolean {
  const { user, isAdmin, isReadOnly } = ctx;
  if (!user) return false;
  if (user.role === "CR") return false;
  if (isAdmin || user.is_superuser) return true;
  return !isReadOnly && (user.role === "SIAE" || user.role === "ENG");
}

export function canEditShift(
  ctx: PermissionContext,
  shiftRole: "SIAE" | "ENG"
): boolean {
  const { user, isAdmin, isManager } = ctx;
  if (!user) return false;
  if (user.role === "CR") return false;
  if (isAdmin || user.is_superuser) return true;
  return isManager && user.role === shiftRole;
}

export function canDeleteAssignment(
  ctx: PermissionContext,
  assignmentUserId: number,
  assignmentUserRole: string
): boolean {
  const { user, isAdmin, isManager } = ctx;
  if (!user) return false;
  if (user.role === "CR") return false;
  if (isAdmin || user.is_superuser) return true;
  if (isManager && assignmentUserRole === user.role) return true;
  return assignmentUserId === user.id;
}

export function canSeePhone(ctx: PermissionContext): boolean {
  const { user, isAdmin } = ctx;
  if (!user) return false;
  return user.role === "CR" || isAdmin || !!user.is_superuser;
}
