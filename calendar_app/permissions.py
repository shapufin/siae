from typing import Any

from rest_framework import permissions
from rest_framework.request import Request


def _same_domain(request: Request, obj: Any) -> bool:
    """
    Manager can only touch objects in their role domain or
    assigned technologies. Admin bypasses.
    """
    if request.user.is_admin:
        return True
    if request.user.is_manager:
        # Check role domain
        target_role = None
        if hasattr(obj, "user") and hasattr(obj.user, "role"):
            target_role = obj.user.role
        elif hasattr(obj, "assignment") and hasattr(
            obj.assignment, "user"
        ) and hasattr(obj.assignment.user, "role"):
            target_role = obj.assignment.user.role
        elif hasattr(obj, "role"):
            target_role = obj.role

        if target_role and target_role == request.user.role:
            return True

        # Check technology assignment or role for Shifts
        from .models import Shift
        if isinstance(obj, Shift):
            if obj.technology.role == request.user.role:
                return True
            return obj.technology.assigned_users.filter(pk=request.user.pk).exists()

        return False
    return False


class IsOwnerOrAdmin(permissions.BasePermission):
    """Owner, admin, or domain manager can modify."""

    def has_permission(self, request: Request, view: Any) -> bool:
        return request.user.is_authenticated

    def has_object_permission(self, request: Request, view: Any, obj: Any) -> bool:
        if request.user.is_admin:
            return True
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_manager and _same_domain(request, obj):
            return True
        if hasattr(obj, "user"):
            return obj.user == request.user
        if hasattr(obj, "created_by"):
            return obj.created_by == request.user
        return False


class CanEditShift(permissions.BasePermission):
    """Admin or manager can create/update/delete shifts. Everyone authenticated can read."""

    def has_permission(self, request: Request, view: Any) -> bool:
        if not request.user.is_authenticated:
            return False
        if request.user.is_admin or request.user.is_manager:
            return True
        return request.method in permissions.SAFE_METHODS

    def has_object_permission(self, request: Request, view: Any, obj: Any) -> bool:
        if not request.user.is_authenticated:
            return False
        # Admins and safe methods always allowed
        if request.user.is_admin or request.method in permissions.SAFE_METHODS:
            return True
        # Managers may only mutate shifts within their domain
        if request.user.is_manager:
            return obj.technology.role == request.user.role
        return False


class CanManageAssignment(permissions.BasePermission):
    """Assignment management permission with domain checks."""

    def has_permission(self, request: Request, view: Any) -> bool:
        if not request.user.is_authenticated:
            return False
        if request.user.is_admin or request.user.is_manager:
            return True
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.role in ["SIAE", "ENG"]

    def has_object_permission(self, request: Request, view: Any, obj: Any) -> bool:
        if not request.user.is_authenticated:
            return False
        if request.user.is_admin:
            return True
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_manager:
            return _same_domain(request, obj)
        if request.user.is_read_only:
            return request.method in permissions.SAFE_METHODS
        if hasattr(obj, "user"):
            return obj.user == request.user
        return True


class IsAdminOrManagerOrReadOnly(permissions.BasePermission):
    """Admin/Manager can write; everyone else read-only."""

    def has_permission(self, request: Request, view: Any) -> bool:
        if not request.user.is_authenticated:
            return False
        if request.user.is_admin or request.user.is_manager:
            return True
        return request.method in permissions.SAFE_METHODS


class IsSuperUser(permissions.BasePermission):
    """Only Django superusers."""

    def has_permission(self, request: Request, view: Any) -> bool:
        return request.user.is_authenticated and request.user.is_superuser
