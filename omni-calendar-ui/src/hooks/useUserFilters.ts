import { useMemo } from "react";
import type { User, Assignment } from "../types";

interface UseUserFiltersOptions {
  users: User[] | undefined;
  technologyId: number | undefined;
  isAdmin: boolean;
  currentUserRole: string | undefined;
  shiftAssignments?: Assignment[];
  assignmentType?: "WORK_HOURS" | "STANDBY";
  currentAssignmentId?: number;
  onlyTechMembers?: boolean;
}

export function useFilteredUsers(options: UseUserFiltersOptions) {
  const {
    users,
    technologyId,
    isAdmin,
    currentUserRole,
    shiftAssignments,
    assignmentType,
    currentAssignmentId,
    onlyTechMembers,
  } = options;

  // Step 1: Filter by role (admins see all)
  const roleFiltered = useMemo(() => {
    if (!users) return [];
    if (isAdmin || !currentUserRole) return users;
    return users.filter((u) => u.role === currentUserRole);
  }, [users, isAdmin, currentUserRole]);

  // Step 2: Sort by technology relevance (default first)
  const sortedUsers = useMemo(() => {
    if (!roleFiltered || !technologyId) return roleFiltered;
    return [...roleFiltered].sort((a, b) => {
      const aTech = a.technologies?.find((t) => t.technology.id === technologyId);
      const bTech = b.technologies?.find((t) => t.technology.id === technologyId);
      const aDefault = aTech?.is_default ? 2 : aTech ? 1 : 0;
      const bDefault = bTech?.is_default ? 2 : bTech ? 1 : 0;
      return bDefault - aDefault;
    });
  }, [roleFiltered, technologyId]);

  // Step 3: Filter by technology membership
  const techFiltered = useMemo(() => {
    if (!sortedUsers || !onlyTechMembers || !technologyId) return sortedUsers;
    return sortedUsers.filter((u) =>
      u.technologies?.some((t) => t.technology.id === technologyId)
    );
  }, [sortedUsers, onlyTechMembers, technologyId]);

  // Step 4: Filter out already-assigned users (excluding current assignment)
  const filteredUsers = useMemo(() => {
    if (!techFiltered) return [];
    if (!shiftAssignments || !assignmentType) return techFiltered;

    const existingUserIds = shiftAssignments
      .filter((a) => a.type === assignmentType && a.id !== currentAssignmentId)
      .map((a) => a.user.id);

    return techFiltered.filter((u) => !existingUserIds.includes(u.id));
  }, [techFiltered, shiftAssignments, assignmentType, currentAssignmentId]);

  return {
    users: filteredUsers,
    sortedUsers,
    roleFiltered,
    techFiltered,
  };
}
