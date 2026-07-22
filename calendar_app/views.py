import logging
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Prefetch, Q, QuerySet
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework import serializers as drf_serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from .pagination import FlexiblePageNumberPagination
from .email import send_smtp_email
from .models import (
    Assignment,
    CustomUser,
    Shift,
    SiteSettings,
    StandbyDetail,
    Technology,
    Vacation,
)
from .permissions import (
    CanEditShift,
    CanManageAssignment,
    IsAdminOrManagerOrReadOnly,
    IsOwnerOrAdmin,
    IsOwnerOrSuperUser,
    IsSuperUser,
)
from .serializers import (
    AdminUserUpdateSerializer,
    AssignmentSerializer,
    CurrentUserSerializer,
    DefaultCrewSerializer,
    ManagerUserUpdateSerializer,
    PasswordResetSerializer,
    ShiftListSerializer,
    ShiftSerializer,
    SiteSettingsPublicSerializer,
    SiteSettingsSerializer,
    StandbyDetailSerializer,
    TechnologySerializer,
    UserCreateSerializer,
    UserSerializer,
    VacationOverlapSerializer,
    VacationSerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class HealthCheckView(generics.GenericAPIView):
    """Endpoint for infrastructure health monitoring."""
    permission_classes = [permissions.AllowAny]

    def get(self, request: Any) -> Response:
        return Response({
            "status": "healthy",
            "timestamp": timezone.now(),
            "version": "1.0.0"
        })


class TechnologyViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Technology categories.
    Implements caching for the full technology list to optimize frontend loading.
    """
    queryset = Technology.objects.all()
    serializer_class = TechnologySerializer
    permission_classes = [IsAdminOrManagerOrReadOnly]
    lookup_field = "slug"

    def perform_create(self, serializer: drf_serializers.Serializer) -> None:
        """Assign the creator's role to the technology if the creator is a manager."""
        user = self.request.user
        if not user.is_admin and user.is_manager:
            serializer.save(role=user.role)
        else:
            serializer.save()

    def list(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        """List technologies with support for full-list caching and search filtering."""
        from django.core.cache import cache
        user = request.user
        is_shared = request.query_params.get("all") == "true"
        role_suffix = "_all" if is_shared or user.is_admin or user.role == "CR" else f"_{user.role}"
        cache_key = f"technologies_list{role_suffix}"
        
        # Only cache the full list (no search)
        search = request.query_params.get("search")
        if not search:
            data = cache.get(cache_key)
            if data is not None:
                return Response(data)

            response = super().list(request, *args, **kwargs)
            cache.set(cache_key, response.data, 3600)
            return response
        return super().list(request, *args, **kwargs)

    def get_queryset(self) -> QuerySet[Technology]:
        queryset = Technology.objects.all()
        user = self.request.user
        is_shared = self.request.query_params.get("all") == "true"
        
        # Admin, CR, and shared views see all technologies
        if user.is_admin or user.role == "CR" or is_shared:
            pass
        elif user.is_manager:
            # Managers see their own domain by default
            queryset = queryset.filter(role=user.role)
        else:
            # Regular users see their own domain's technologies
            queryset = queryset.filter(role=user.role)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    def get_object(self) -> Technology:
        """
        Retrieve technology by slug with explicit domain permission check.
        Uses base queryset (no role filtering) for lookup to provide clear
        permission errors instead of confusing 404s.
        """
        from rest_framework.exceptions import PermissionDenied
        from django.shortcuts import get_object_or_404
        
        user = self.request.user
        slug = self.kwargs.get(self.lookup_field)
        
        # Look up without role filtering to check permissions explicitly
        obj = get_object_or_404(Technology, slug=slug)
        
        # Enforce domain isolation at object level for managers
        if user.is_manager and not user.is_admin:
            if obj.role != user.role:
                raise PermissionDenied(
                    detail=f"Domain isolation: You manage '{user.role}' but this technology belongs to '{obj.role}'."
                )
        
        return obj


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet for user management with domain-scoped visibility.
    Supports vacation status annotation and technology-based filtering.
    """
    queryset = User.objects.all()
    permission_classes = [IsAdminOrManagerOrReadOnly]

    def get_queryset(self) -> QuerySet[CustomUser]:
        """Filter users based on role-based domain access and optional vacation status."""
        user = self.request.user
        date = self.request.query_params.get("date")
        qs = (
            User.objects.with_vacation_status(date)
            if date else User.objects.all()
        )
        
        # Admin and CR see everyone
        if user.is_admin or user.role == "CR":
            pass
        elif user.is_manager:
            # Managers see their own domain by default, but can see all if requested
            if self.request.query_params.get("all") != "true":
                qs = qs.filter(role=user.role)
        else:
            # Regular users see their own domain's users
            qs = qs.filter(role=user.role)
            
        qs = qs.prefetch_related(
            "usertechnology_set", "usertechnology_set__technology"
        )
        return qs

    def get_serializer_class(self) -> type[drf_serializers.Serializer]:
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("update", "partial_update"):
            if self.request.user.is_admin:
                return AdminUserUpdateSerializer
            if self.request.user.is_manager:
                return ManagerUserUpdateSerializer
        return UserSerializer

    @action(detail=False, methods=["get"])
    def me(self, request: Any) -> Response:
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=["get"])
    def by_technology(self, request: Any) -> Response:
        tech_id = request.query_params.get("technology")
        if not tech_id:
            return Response(
                {"detail": "technology parameter required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        users = User.objects.filter(
            usertechnology__technology_id=tech_id
        )
        if not user.is_admin and user.role != "CR":
            users = users.filter(role=user.role)
        users = users.distinct()
        serializer = UserSerializer(
            users, many=True, context={"request": request}
        )
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="set-password",
        permission_classes=[permissions.IsAuthenticated, IsOwnerOrSuperUser],
    )
    def set_password(self, request: Any, pk: int | None = None) -> Response:
        """Reset any user's password (superuser) or own password (manager/user)."""
        user = self.get_object()
        serializer = PasswordResetSerializer(data=request.data)
        if serializer.is_valid():
            user.set_password(serializer.validated_data["new_password"])
            user.save()
            logger.info("Password reset for user %s by %s", user.username, request.user.username)
            return Response(
                {"detail": f"Password reset for {user.username}."},
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VacationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user vacations.
    Enforces domain-level isolation for managers and owner-only access for regular users.
    """
    queryset = Vacation.objects.select_related("user")
    serializer_class = VacationSerializer
    permission_classes = [IsOwnerOrAdmin]
    pagination_class = None

    def get_queryset(self) -> QuerySet[Vacation]:
        """Filter vacations based on role-based domain access."""
        user = self.request.user
        
        # Detection of shared dashboard view (date range or explicit all parameter)
        is_shared_view = any(p in self.request.query_params for p in ["month", "year", "start_date__lte", "end_date__gte", "all"])
        
        if user.is_admin or user.is_manager or user.role == "CR" or is_shared_view:
            queryset = Vacation.objects.all()
        else:
            queryset = Vacation.objects.filter(user=user)

        # Apply frontend date-range filters for calendar month views
        start_date__lte = self.request.query_params.get("start_date__lte")
        end_date__gte = self.request.query_params.get("end_date__gte")
        if start_date__lte:
            queryset = queryset.filter(start_date__lte=start_date__lte)
        if end_date__gte:
            queryset = queryset.filter(end_date__gte=end_date__gte)

        return queryset

    @action(detail=False, methods=["post"])
    def overlapping(self, request: Any) -> Response:
        serializer = VacationOverlapSerializer(data=request.data)
        if serializer.is_valid():
            vacations = serializer.get_overlapping()
            response_serializer = VacationSerializer(vacations, many=True)
            return Response(response_serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def current_week(self, request: Any) -> Response:
        today = timezone.now().date()
        start_week = today - timezone.timedelta(days=today.weekday())
        end_week = start_week + timezone.timedelta(days=6)

        queryset = Vacation.objects.filter(
            Q(start_date__lte=end_week) & Q(end_date__gte=start_week)
        )
        if request.user.role == "CR" or request.user.is_admin:
            pass
        elif request.user.is_manager:
            queryset = queryset.filter(user__role=request.user.role)
        else:
            queryset = queryset.filter(user=request.user)
        serializer = VacationSerializer(queryset, many=True)
        return Response(serializer.data)


class ShiftViewSet(viewsets.ModelViewSet):
    """
    ViewSet for orchestration of daily shifts.
    Handles complex annotations for standby status and provides bulk operations.
    """
    queryset = Shift.objects.all().order_by("-date", "technology__name")
    permission_classes = [CanEditShift]
    pagination_class = FlexiblePageNumberPagination

    def get_serializer_class(self) -> type[drf_serializers.Serializer]:
        """Select serializer based on view action and detail context."""
        if self.action == "list" and not self.request.query_params.get("date"):
            return ShiftListSerializer
        return ShiftSerializer

    def perform_create(self, serializer: drf_serializers.Serializer) -> None:
        serializer.save(created_by=self.request.user)

    def get_queryset(self) -> QuerySet[Shift]:
        queryset = Shift.objects.all().select_related("technology", "created_by")
        user = self.request.user

        # Support fetching all shifts for shared visibility on the calendar
        # Shared dashboard should show all domains
        is_shared_view = any(p in self.request.query_params for p in ["month", "year", "date", "date__gte", "date__lte", "all"])
        
        if user.is_admin or user.role == "CR" or is_shared_view:
            pass
        elif user.is_manager:
            # For management actions (single date or tech search), default to own domain
            queryset = queryset.filter(technology__role=user.role)
        else:
            # Regular users only see shifts in their own domain outside of shared views
            queryset = queryset.filter(technology__role=user.role)
        
        # Annotate has_standby: True if there is at least one assignment of type STANDBY
        queryset = queryset.annotate(
            assignment_count=Count("assignments"),
            has_standby=Exists(
                Assignment.objects.filter(
                    shift=OuterRef("pk"),
                    type="STANDBY"
                )
            )
        )

        date = self.request.query_params.get("date")
        if date:
            queryset = queryset.filter(date=date)
            # Annotate users with assignment status for OTHER technologies on this same day
            user_qs = User.objects.with_vacation_status(date).annotate(
                is_assigned=Exists(
                    Assignment.objects.filter(
                        user=OuterRef("pk"),
                        shift__date=date
                    ).exclude(shift__technology=OuterRef("assignments__shift__technology"))
                )
            )
            queryset = queryset.prefetch_related(
                Prefetch(
                    "assignments",
                    queryset=Assignment.objects.prefetch_related(
                        Prefetch("user", queryset=user_qs),
                        "standby_detail",
                    ),
                )
            )
        month = self.request.query_params.get("month")
        year = self.request.query_params.get("year")
        if month and year:
            queryset = queryset.filter(
                date__month=month, date__year=year
            )
        technology = self.request.query_params.get("technology")
        if technology:
            queryset = queryset.filter(technology_id=technology)

        # Apply frontend date-range filters for calendar month views
        date__gte = self.request.query_params.get("date__gte")
        date__lte = self.request.query_params.get("date__lte")
        if date__gte:
            queryset = queryset.filter(date__gte=date__gte)
        if date__lte:
            queryset = queryset.filter(date__lte=date__lte)

        return queryset.order_by("-date", "technology__name")

    def get_serializer_context(self) -> dict[str, Any]:
        context = super().get_serializer_context()
        date = self.request.query_params.get("date")
        if date:
            context["date"] = date
        return context

    @action(detail=True, methods=["get"])
    def assignments(self, request: Any, pk: int | None = None) -> Response:
        shift = self.get_object()
        date = shift.date
        # Annotate users with assignment status for OTHER technologies on this same day
        user_qs = User.objects.with_vacation_status(date).annotate(
            is_assigned=Exists(
                Assignment.objects.filter(
                    user=OuterRef("pk"),
                    shift__date=date
                ).exclude(shift__technology=shift.technology)
            )
        )
        assignments = shift.assignments.prefetch_related(
            Prefetch("user", queryset=user_qs),
            "standby_detail"
        )
        serializer = AssignmentSerializer(assignments, many=True, context=self.get_serializer_context())
        return Response(serializer.data)

    @action(detail=False, methods=["post"])
    def bulk_delete_by_technology(self, request: Any) -> Response:
        """
        Atomically delete shifts or assignments across a technology/date range.
        Requires explicit assignment_type (WORK_HOURS, STANDBY, or ALL).
        """
        technology_ids = request.data.get("technology_ids", [])
        date_start = request.data.get("date_start")
        date_end = request.data.get("date_end")
        # Normalize assignment_type to uppercase and default to "ALL"
        assignment_type = str(request.data.get("assignment_type") or "ALL").upper()

        if not technology_ids:
            return Response({"deleted": 0}, status=status.HTTP_200_OK)

        with transaction.atomic():
            qs = Shift.objects.filter(technology_id__in=technology_ids)
            if not request.user.is_admin and request.user.role != "CR":
                qs = qs.filter(technology__role=request.user.role)
            
            if date_start:
                qs = qs.filter(date__gte=date_start)
            if date_end:
                qs = qs.filter(date__lte=date_end)

            # If specific assignment type, delete only those assignments
            if assignment_type in ["WORK_HOURS", "STANDBY"]:
                assignments = Assignment.objects.filter(
                    shift__in=qs,
                    type=assignment_type
                )
                count, _ = assignments.delete()
                logger.info(f"Bulk delete: {count} {assignment_type} assignments deleted by user {request.user}")
                return Response({"deleted": count}, status=status.HTTP_200_OK)

            # If "ALL", delete entire shifts (this cascades to all assignments)
            if assignment_type == "ALL":
                count, _ = qs.delete()
                logger.info(f"Bulk delete: {count} shifts deleted by user {request.user}")
                return Response({"deleted": count}, status=status.HTTP_200_OK)

        # fallback
        return Response({"deleted": 0, "detail": f"Unknown assignment type: {assignment_type}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"])
    def fix_defaults(self, request: Any) -> Response:
        """
        For each shift in the date range and technology set:
          - Remove WORK_HOURS assignments for users whose default technology is NOT this one.
          - Add WORK_HOURS assignments for users whose default technology IS this one (if missing).
        Returns counts of removed and added assignments.
        """
        technology_ids = request.data.get("technology_ids", [])
        date_start = request.data.get("date_start")
        date_end = request.data.get("date_end")

        if not technology_ids:
            return Response({"removed": 0, "added": 0}, status=status.HTTP_200_OK)

        from .models import UserTechnology

        removed_count = 0
        added_count = 0

        with transaction.atomic():
            # Get all default users for selected technologies once
            default_users_by_tech = {}
            user_techs = UserTechnology.objects.filter(
                technology_id__in=technology_ids,
                is_default=True
            ).values_list("technology_id", "user_id")
            
            for tech_id, user_id in user_techs:
                if tech_id not in default_users_by_tech:
                    default_users_by_tech[tech_id] = set()
                default_users_by_tech[tech_id].add(user_id)

            qs = Shift.objects.filter(technology_id__in=technology_ids)
            if not request.user.is_admin and request.user.role != "CR":
                qs = qs.filter(technology__role=request.user.role)

            if date_start:
                qs = qs.filter(date__gte=date_start)
            if date_end:
                qs = qs.filter(date__lte=date_end)

            # Prefetch assignments for efficiency
            shifts = qs.prefetch_related("assignments", "assignments__user")

            for shift in shifts:
                # Get current WORK_HOURS assignment user IDs
                current_work_hours = {
                    a.user_id: a
                    for a in shift.assignments.all()
                    if a.type == "WORK_HOURS"
                }

                # Find users who have this technology as default
                default_user_ids = default_users_by_tech.get(shift.technology_id, set())

                # Remove non-default users
                for user_id, assignment in current_work_hours.items():
                    if user_id not in default_user_ids:
                        assignment.delete()
                        removed_count += 1

                # Add missing default users
                already_assigned = set(current_work_hours.keys())
                for user_id in default_user_ids:
                    if user_id not in already_assigned:
                        Assignment.objects.create(
                            shift=shift,
                            user_id=user_id,
                            type="WORK_HOURS"
                        )
                        added_count += 1

        logger.info(
            f"Fix defaults: {removed_count} removed, {added_count} added by user {request.user} "
            f"for techs {technology_ids} from {date_start} to {date_end}"
        )
        return Response({"removed": removed_count, "added": added_count}, status=status.HTTP_200_OK)


class AssignmentViewSet(viewsets.ModelViewSet):
    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    permission_classes = [CanManageAssignment]

    def get_queryset(self) -> QuerySet[Assignment]:
        queryset = Assignment.objects.select_related("user", "shift", "shift__technology")
        user = self.request.user
        is_shared = self.request.query_params.get("all") == "true"
        
        # Admin, CR, and shared views see all assignments
        if user.is_admin or user.role == "CR" or is_shared:
            pass
        elif user.is_manager:
            # Managers see their own domain assignments by default
            queryset = queryset.filter(user__role=user.role)
        else:
            # Regular users see their own domain
            queryset = queryset.filter(user__role=user.role)

        shift_id = self.request.query_params.get("shift")
        if shift_id:
            queryset = queryset.filter(shift_id=shift_id)
        user_id = self.request.query_params.get("user")
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        return queryset

    def get_serializer_context(self) -> dict[str, Any]:
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class StandbyDetailViewSet(viewsets.ModelViewSet):
    queryset = StandbyDetail.objects.all()
    serializer_class = StandbyDetailSerializer
    permission_classes = [CanManageAssignment]

    def get_queryset(self) -> QuerySet[StandbyDetail]:
        queryset = StandbyDetail.objects.select_related("assignment__user")
        user = self.request.user
        is_shared = self.request.query_params.get("all") == "true"
        
        # Admin, CR, and shared views see all standby details
        if user.is_admin or user.role == "CR" or is_shared:
            pass
        elif user.is_manager:
            # Managers see their own domain details by default
            queryset = queryset.filter(assignment__user__role=user.role)
        else:
            # Regular users see their own domain
            queryset = queryset.filter(assignment__user__role=user.role)
            
        return queryset

    def perform_create(self, serializer: drf_serializers.Serializer) -> None:
        serializer.save()

    def partial_update(self, request: Any, *args: Any, **kwargs: Any) -> Response:
        from django.db import transaction
        with transaction.atomic():
            instance = self.get_object()
            # Lock standby rows for this shift to prevent race conditions
            list(
                StandbyDetail.objects.select_for_update().filter(
                    assignment__shift=instance.assignment.shift
                )
            )

            new_role = request.data.get("role")
            if new_role and new_role != instance.role:
                other = StandbyDetail.objects.filter(
                    assignment__shift=instance.assignment.shift,
                    role=new_role
                ).exclude(pk=instance.pk).first()
                if other:
                    other.role = instance.role
                    other.save()
            return super().partial_update(request, *args, **kwargs)


class DefaultCrewView(generics.RetrieveAPIView):
    serializer_class = DefaultCrewSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "pk"

    def get_queryset(self) -> QuerySet[Technology]:
        qs = Technology.objects.all()
        user = self.request.user
        if user.is_admin or user.role == "CR":
            return qs
        return qs.filter(role=user.role)

    def get_serializer_context(self) -> dict[str, Any]:
        context = super().get_serializer_context()
        context["request"] = self.request
        return context


class NotificationBadgeView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request: Any) -> Response:
        queryset = Vacation.objects.all()
        user = request.user
        if user.is_admin:
            pass
        elif user.role in ("SIAE", "ENG"):
            other_role = "ENG" if user.role == "SIAE" else "SIAE"
            queryset = queryset.filter(user__role=other_role)
        else:
            queryset = queryset.filter(user=user)

        count = queryset.count()
        vacations = queryset.select_related("user").order_by("-start_date")[:10]

        data = {
            "count": count,
            "vacations": VacationSerializer(vacations, many=True).data,
        }
        return Response(data)


class ShiftByDateTechnologyView(generics.ListAPIView):
    serializer_class = ShiftSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self) -> QuerySet[Shift]:
        date = self.kwargs.get("date")
        technology_id = self.kwargs.get("technology_id")

        user_qs = User.objects.all()
        if date:
            user_qs = user_qs.with_vacation_status(date)

        queryset = Shift.objects.select_related("technology").prefetch_related(
            Prefetch("assignments", queryset=Assignment.objects.prefetch_related(
                Prefetch("user", queryset=user_qs),
                "standby_detail"
            ))
        )
        if date:
            queryset = queryset.filter(date=date)
        if technology_id:
            queryset = queryset.filter(technology_id=technology_id)
        return queryset


class SiteSettingsView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = SiteSettingsSerializer

    def get_object(self) -> SiteSettings:
        return SiteSettings.load()

class TestEmailView(generics.GenericAPIView):
    permission_classes = [IsSuperUser]

    def post(self, request: Any) -> Response:
        user = request.user
        if not user.email:
            return Response(
                {"detail": "Your account has no email address."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from .models import SiteSettings
        conf = SiteSettings.load()
        brand = conf.brand_name or "Omni Calendar"
        
        # Use test_email_recipient if configured, otherwise fallback to logged-in user's email
        target_email = conf.test_email_recipient or user.email
        
        # Allow overriding backend for testing
        requested_backend = request.data.get('backend')
        target_backend = requested_backend if requested_backend in ['smtp', 'postfix'] else conf.email_backend
        backend_name = "Postfix" if target_backend == "postfix" else "SMTP"
        
        count = send_smtp_email(
            subject=f"Test Email ({backend_name}) from {brand}",
            body=f"This is a test email via {backend_name} to verify configuration.",
            to_emails=[target_email],
            html_body=f"<h1>Test Email</h1><p>This is a test email via <strong>{backend_name}</strong> to verify configuration.</p>",
            force=True,
            backend_override=target_backend,
        )
        if count:
            return Response({"detail": f"Test email sent via {backend_name}."}, status=status.HTTP_200_OK)
        return Response(
            {"detail": f"Email not sent via {backend_name}. Check settings or enable notifications."},
            status=status.HTTP_400_BAD_REQUEST,
        )

class SiteSettingsPublicView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = SiteSettingsPublicSerializer

    def get_object(self) -> SiteSettings:
        return SiteSettings.load()


class ResetDatabaseView(generics.GenericAPIView):
    """Destructive admin endpoint to reset all operational data while preserving config."""

    permission_classes = [IsSuperUser]

    def post(self, request: Any) -> Response:
        # Rate limit destructive operations
        from django.core.cache import cache
        cooldown_key = "admin_destructive_op_cooldown"
        if cache.get(cooldown_key):
            return Response(
                {"detail": "A destructive operation was recently performed. Please wait 5 minutes."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Verify explicit confirmation token to prevent accidental triggers
        confirm = request.data.get("confirm")
        if confirm != "RESET_ALL_DATA":
            return Response(
                {"detail": "Invalid confirmation token. Send confirm='RESET_ALL_DATA'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            deleted = {
                "vacations": Vacation.objects.all().count(),
                "shifts": Shift.objects.all().count(),
                "users": 0,
            }

            # 1. Delete all vacations
            Vacation.objects.all().delete()

            # 2. Delete all shifts (cascades to assignments + standby details)
            Shift.objects.all().delete()

            # 3. Delete all non-superuser accounts (preserves admin access)
            users_qs = CustomUser.objects.filter(is_superuser=False)
            deleted["users"] = users_qs.count()
            users_qs.delete()

            # Set cooldown
            cache.set(cooldown_key, True, 300)  # 5 minute cooldown
            logger.warning(f"DATABASE RESET performed by superuser {request.user}")

        return Response(
            {
                "detail": "Database reset complete.",
                "preserved": {
                    "superusers": CustomUser.objects.filter(is_superuser=True).count(),
                    "technologies": Technology.objects.all().count(),
                },
                "deleted": deleted,
            },
            status=status.HTTP_200_OK,
        )


class BackupView(generics.GenericAPIView):
    """Export all operational data as a JSON snapshot (superuser only)."""

    permission_classes = [IsSuperUser]

    def get(self, request: Any) -> Response:
        technologies = list(
            Technology.objects.values("id", "name", "slug", "color_code", "role")
        )
        users = list(
            CustomUser.objects.values(
                "id",
                "username",
                "first_name",
                "last_name",
                "email",
                "role",
                "is_active",
                "is_staff",
                "is_superuser",
                "phone_number",
            )
        )
        # Attach user-technology links
        user_technologies = list(
            CustomUser.technologies.through.objects.values(
                "id", "user_id", "technology_id"
            )
        )

        shifts = []
        for shift in Shift.objects.select_related("technology").all():
            shift_data = {
                "id": shift.id,
                "date": shift.date.isoformat(),
                "technology_slug": shift.technology.slug,
                "notes": shift.notes,
                "assignments": [],
            }
            for assignment in shift.assignments.select_related("user").all():
                assign_data = {
                    "id": assignment.id,
                    "user_username": assignment.user.username,
                    "type": assignment.type,
                }
                if hasattr(assignment, "standby_detail") and assignment.standby_detail:
                    sd = assignment.standby_detail
                    assign_data["standby_detail"] = {
                        "role": sd.role,
                        "phone_number": sd.phone_number,
                    }
                shift_data["assignments"].append(assign_data)
            shifts.append(shift_data)

        vacations = list(
            Vacation.objects.values(
                "id", "user_id", "start_date", "end_date", "type", "notes"
            )
        )

        # Exclude sensitive settings from backup
        site_settings_data = SiteSettingsSerializer(SiteSettings.load()).data
        sensitive_fields = ["smtp_password", "smtp_user", "smtp_host", "smtp_from_email"]
        for field in sensitive_fields:
            site_settings_data.pop(field, None)

        payload = {
            "version": "1.0",
            "exported_at": timezone.now().isoformat(),
            "technologies": technologies,
            "users": users,
            "user_technologies": user_technologies,
            "shifts": shifts,
            "vacations": vacations,
            "site_settings": site_settings_data,
        }
        return Response(payload, status=status.HTTP_200_OK)


class RestoreView(generics.GenericAPIView):
    """Restore operational data from a JSON snapshot (superuser only).

    Requires confirm='RESTORE_FROM_BACKUP'.
    Preserves existing superusers; restores other users with unusable passwords.
    """

    permission_classes = [IsSuperUser]

    def post(self, request: Any) -> Response:
        # Rate limit destructive operations
        from django.core.cache import cache
        cooldown_key = "admin_destructive_op_cooldown"
        if cache.get(cooldown_key):
            return Response(
                {"detail": "A destructive operation was recently performed. Please wait 5 minutes."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        confirm = request.data.get("confirm")
        if confirm != "RESTORE_FROM_BACKUP":
            return Response(
                {"detail": "Invalid confirmation token. Send confirm='RESTORE_FROM_BACKUP'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = request.data.get("payload")
        if not payload or not isinstance(payload, dict):
            return Response(
                {"detail": "Missing or invalid payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate version
        version = payload.get("version")
        if version != "1.0":
            return Response(
                {"detail": f"Unsupported backup version: {version}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # 1. Wipe operational data
            Vacation.objects.all().delete()
            Shift.objects.all().delete()
            CustomUser.objects.filter(is_superuser=False).delete()

            # 2. Restore technologies (update or create by slug)
            tech_id_map: dict[int, Technology] = {}
            for t in payload.get("technologies", []):
                tech, _ = Technology.objects.update_or_create(
                    slug=t["slug"],
                    defaults={
                        "name": t["name"],
                        "color_code": t.get("color_code", "#3b82f6"),
                        "role": t.get("role", "CR"),
                    },
                )
                tech_id_map[t["id"]] = tech

            # 3. Restore users (update or create by username; set unusable password)
            user_id_map: dict[int, CustomUser] = {}
            for u in payload.get("users", []):
                user, _ = CustomUser.objects.update_or_create(
                    username=u["username"],
                    defaults={
                        "first_name": u.get("first_name", ""),
                        "last_name": u.get("last_name", ""),
                        "email": u.get("email", ""),
                        "role": u.get("role", "CR"),
                        "is_active": u.get("is_active", True),
                        "is_staff": u.get("is_staff", False),
                        "is_superuser": u.get("is_superuser", False),
                        "phone_number": u.get("phone_number", ""),
                    },
                )
                user.set_unusable_password()
                user.save(update_fields=["password"])
                user_id_map[u["id"]] = user

            # 4. Restore user-technology links
            for ut in payload.get("user_technologies", []):
                user = user_id_map.get(ut.get("user_id"))
                tech = tech_id_map.get(ut.get("technology_id"))
                if user and tech:
                    user.technologies.add(tech)

            # 5. Restore shifts + assignments + standby details
            shifts_data = payload.get("shifts", [])
            shift_objects = []
            for s in shifts_data:
                tech = tech_id_map.get(s.get("technology_id"))
                if not tech:
                    tech = Technology.objects.filter(slug=s.get("technology_slug")).first()
                if tech:
                    shift_objects.append(
                        Shift(
                            date=s["date"],
                            technology=tech,
                            notes=s.get("notes", ""),
                        )
                    )
            
            # Bulk create shifts
            Shift.objects.bulk_create(shift_objects, ignore_conflicts=True)
            
            # Re-fetch shifts to get IDs (keyed by date and technology_id)
            current_shifts = {
                (str(s.date), s.technology_id): s 
                for s in Shift.objects.all()
            }

            assignments_to_create = []
            standby_data_to_map = [] # Temp storage for standby details

            for s_data in shifts_data:
                tech = tech_id_map.get(s_data.get("technology_id"))
                if not tech:
                    tech = Technology.objects.filter(slug=s_data.get("technology_slug")).first()
                
                if not tech:
                    continue
                
                shift = current_shifts.get((s_data["date"], tech.id))
                if not shift:
                    continue

                for a_data in s_data.get("assignments", []):
                    user = user_id_map.get(a_data.get("user_id"))
                    if not user:
                        user = CustomUser.objects.filter(username=a_data.get("user_username")).first()
                    if not user:
                        continue
                    
                    assignment = Assignment(
                        shift=shift,
                        user=user,
                        type=a_data.get("type", "WORK_HOURS"),
                    )
                    assignments_to_create.append(assignment)
                    
                    if a_data.get("standby_detail") and assignment.type == "STANDBY":
                        standby_data_to_map.append((assignment, a_data["standby_detail"]))

            # Bulk create assignments
            created_assignments = Assignment.objects.bulk_create(assignments_to_create, ignore_conflicts=True)
            
            # For standby details, we need the assignment IDs. 
            # Since bulk_create might not return IDs on all DB backends (like SQLite), 
            # we re-fetch assignments for this shift set if needed, or if PostgreSQL, we have them.
            # To be safe across backends, we'll re-fetch assignments.
            all_assignments = {
                (a.shift_id, a.user_id, a.type): a 
                for a in Assignment.objects.filter(shift__in=current_shifts.values())
            }

            standby_details_to_create = []
            for assignment_obj, sd_data in standby_data_to_map:
                # Find the actual saved assignment with ID
                key = (assignment_obj.shift_id, assignment_obj.user_id, assignment_obj.type)
                saved_assignment = all_assignments.get(key)
                if saved_assignment:
                    standby_details_to_create.append(
                        StandbyDetail(
                            assignment=saved_assignment,
                            shift=saved_assignment.shift,
                            role=sd_data.get("role", "PRIMARY"),
                            phone_number=sd_data.get("phone_number", ""),
                        )
                    )
            
            if standby_details_to_create:
                StandbyDetail.objects.bulk_create(standby_details_to_create, ignore_conflicts=True)

            # 6. Restore vacations
            vacations_to_create = []
            for v in payload.get("vacations", []):
                user = user_id_map.get(v.get("user_id"))
                if not user:
                    user = CustomUser.objects.filter(id=v.get("user_id")).first()
                if user:
                    vacations_to_create.append(
                        Vacation(
                            user=user,
                            start_date=v["start_date"],
                            end_date=v["end_date"],
                            type=v.get("type", "PTO"),
                            notes=v.get("notes", ""),
                        )
                    )
            if vacations_to_create:
                Vacation.objects.bulk_create(vacations_to_create)

            # 7. Restore site settings
            ss = payload.get("site_settings")
            if ss:
                settings = SiteSettings.load()
                for key, value in ss.items():
                    if hasattr(settings, key) and key != "id":
                        setattr(settings, key, value)
                settings.save()

            # Set cooldown
            cache.set(cooldown_key, True, 300)  # 5 minute cooldown
            logger.warning(f"DATABASE RESTORE performed by superuser {request.user}")

        return Response(
            {
                "detail": "Restore complete.",
                "restored": {
                    "technologies": len(tech_id_map),
                    "users": len(user_id_map),
                    "shifts": len(payload.get("shifts", [])),
                    "vacations": len(payload.get("vacations", [])),
                },
            },
            status=status.HTTP_200_OK,
        )
