import logging
from datetime import timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.core.validators import RegexValidator
from django.db.models import Q, QuerySet
from django.utils.html import strip_tags
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.settings import api_settings

from .models import (
    Assignment,
    CustomUser,
    Shift,
    SiteSettings,
    StandbyDetail,
    Technology,
    UserTechnology,
    Vacation,
)

User = get_user_model()
logger = logging.getLogger(__name__)

MAX_NOTES_LENGTH = 5000


class UserTechnologyUpdateMixin:
    """Mixin to share technology update logic between user serializers."""

    def _update_technologies(self, instance: CustomUser, techs_data: list[dict[str, Any]] | None) -> None:
        if techs_data is not None:
            UserTechnology.objects.filter(user=instance).delete()
            for td in techs_data:
                tech_id = td.get("technology_id") or td.get("id")
                is_default = td.get("is_default", False)
                if tech_id:
                    UserTechnology.objects.create(
                        user=instance,
                        technology_id=tech_id,
                        is_default=is_default,
                    )


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user: Any) -> Any:
        token = super().get_token(user)
        token["role"] = user.role
        token["is_superuser"] = user.is_superuser
        token["is_staff"] = user.is_staff
        token["username"] = user.username
        return token

    def validate(self, attrs: Any) -> dict[str, Any]:
        data: dict[str, Any] = super(
            TokenObtainPairSerializer, self
        ).validate(attrs)

        try:
            conf = SiteSettings.load()
            # Enforce maximum limits for JWT lifetimes
            access_minutes = min(conf.jwt_access_minutes, 1440)  # Max 24 hours
            refresh_days = min(conf.jwt_refresh_days, 30)       # Max 30 days

            access_lifetime = timedelta(minutes=access_minutes)
            refresh_lifetime = timedelta(days=refresh_days)
        except Exception as e:
            logger.error(f"Error loading JWT lifetimes from SiteSettings: {e}")
            access_lifetime = timedelta(minutes=60)
            refresh_lifetime = timedelta(days=7)

        refresh = self.get_token(self.user)
        refresh.set_exp(lifetime=refresh_lifetime)

        access = refresh.access_token
        access.set_exp(from_time=refresh.current_time, lifetime=access_lifetime)

        data["refresh"] = str(refresh)
        data["access"] = str(access)

        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, self.user)

        return data


class TechnologySerializer(serializers.ModelSerializer):
    class Meta:
        model = Technology
        fields = ["id", "name", "slug", "color_code", "role"]
        extra_kwargs = {"slug": {"required": False}}


class UserTechnologySerializer(serializers.ModelSerializer):
    technology = TechnologySerializer(read_only=True)

    class Meta:
        model = UserTechnology
        fields = ["technology", "is_default"]


class UserSerializer(serializers.ModelSerializer):
    technologies = UserTechnologySerializer(
        source="usertechnology_set", many=True, read_only=True
    )
    vacation_status = serializers.SerializerMethodField()
    is_assigned = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone_number",
            "role",
            "is_active",
            "is_superuser",
            "date_joined",
            "last_login",
            "technologies",
            "vacation_status",
            "is_assigned",
            "permissions",
        ]
        read_only_fields = ["role"]

    def get_vacation_status(self, obj: CustomUser) -> bool | None:
        if hasattr(obj, "vacation_status") and isinstance(obj.vacation_status, bool):
            return obj.vacation_status

        # Get date from context (preferred)
        date = self.context.get("date")
        if not date:
            request = self.context.get("request")
            if request:
                date = request.query_params.get("date")

        if date:
            return obj.vacations.filter(
                start_date__lte=date, end_date__gte=date
            ).exists()
        return None

    def get_is_assigned(self, obj: CustomUser) -> bool:
        if hasattr(obj, "is_assigned") and isinstance(obj.is_assigned, bool):
            return obj.is_assigned
        return False

    def get_permissions(self, obj: CustomUser) -> dict[str, bool]:
        return {
            "is_admin": obj.is_admin,
            "is_manager": obj.is_manager,
            "is_read_only": obj.is_read_only,
            "is_siae": obj.is_siae,
            "is_eng": obj.is_eng,
        }


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=12,
        validators=[
            RegexValidator(
                r'^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&].+$',
                message='Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character.'
            )
        ]
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "role",
            "phone_number",
        ]

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        request = self.context.get("request")
        if request and request.user.is_manager and not request.user.is_admin:
            role = data.get("role")
            if role and role != request.user.role:
                raise serializers.ValidationError(
                    {"role": "You can only create users in your own domain."}
                )
        return data

    def create(self, validated_data: dict[str, Any]) -> CustomUser:
        user = User.objects.create_user(**validated_data)
        return user


class AdminUserUpdateSerializer(UserTechnologyUpdateMixin, serializers.ModelSerializer):
    technologies = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
    )
    is_manager = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "phone_number",
            "is_active",
            "is_staff",
            "is_superuser",
            "technologies",
            "is_manager",
        ]
        read_only_fields = ["id", "username"]

    def update(self, instance: CustomUser, validated_data: dict[str, Any]) -> CustomUser:
        request = self.context.get("request")
        if request and instance == request.user:
            if validated_data.get("is_active") is False:
                raise serializers.ValidationError(
                    {"is_active": "You cannot deactivate your own account."}
                )

        techs_data = validated_data.pop("technologies", None)
        is_manager = validated_data.pop("is_manager", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        self._update_technologies(instance, techs_data)

        if is_manager is not None:
            from django.contrib.auth.models import Group

            manager_group, _ = Group.objects.get_or_create(name="Manager")
            if is_manager:
                instance.groups.add(manager_group)
            else:
                instance.groups.remove(manager_group)

        return instance


class ManagerUserUpdateSerializer(UserTechnologyUpdateMixin, serializers.ModelSerializer):
    technologies = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "phone_number",
            "is_active",
            "technologies",
        ]
        read_only_fields = ["id", "username", "is_staff", "is_superuser", "is_manager"]

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        request = self.context.get("request")
        if request and request.user.is_manager and not request.user.is_admin:
            role = data.get("role")
            if role and role != request.user.role:
                raise serializers.ValidationError(
                    {"role": "You can only manage users in your own domain."}
                )
        return data

    def update(self, instance: CustomUser, validated_data: dict[str, Any]) -> CustomUser:
        request = self.context.get("request")
        if request and instance == request.user:
            if validated_data.get("is_active") is False:
                raise serializers.ValidationError(
                    {"is_active": "You cannot deactivate your own account."}
                )

        techs_data = validated_data.pop("technologies", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        self._update_technologies(instance, techs_data)

        return instance


class PasswordResetSerializer(serializers.Serializer):
    """Superuser-only password reset for any user account."""

    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value: str) -> str:
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters.")
        return value


class VacationSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), write_only=True, source="user"
    )

    def validate_notes(self, value: str) -> str:
        value = strip_tags(value) if value else value
        if value and len(value) > MAX_NOTES_LENGTH:
            raise serializers.ValidationError(
                f"Notes must be {MAX_NOTES_LENGTH} characters or fewer (currently {len(value)})."
            )
        return value

    class Meta:
        model = Vacation
        fields = ["id", "user", "user_id", "start_date", "end_date", "type", "notes", "created_at"]
        read_only_fields = ["created_at"]

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        if data["end_date"] < data["start_date"]:
            raise serializers.ValidationError(
                {"end_date": "End date must be after start date."}
            )
        request = self.context.get("request")
        if request and not request.user.is_admin and not request.user.is_manager:
            target_user = data.get("user")
            if target_user and target_user != request.user:
                raise serializers.ValidationError(
                    {"user_id": "You can only create vacations for yourself."}
                )
        if request and request.user.is_manager and not request.user.is_admin:
            target_user = data.get("user")
            if target_user and target_user.role != request.user.role:
                raise serializers.ValidationError(
                    {"user_id": "You can only manage vacations for users in your own domain."}
                )
        return data


class StandbyDetailSerializer(serializers.ModelSerializer):
    assignment = serializers.PrimaryKeyRelatedField(
        queryset=Assignment.objects.all(), required=False
    )

    class Meta:
        model = StandbyDetail
        fields = ["id", "role", "phone_number", "assignment"]

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        request = self.context.get("request")
        if request and request.user.is_manager and not request.user.is_admin:
            assignment_id = self.initial_data.get("assignment")
            if assignment_id:
                try:
                    assignment = Assignment.objects.select_related("user").get(pk=assignment_id)
                    if assignment.user.role != request.user.role:
                        raise serializers.ValidationError(
                            {
                                "assignment": (
                                    "You can only manage standby details "
                                    "for users in your own domain."
                                )
                            }
                        )
                except Assignment.DoesNotExist as exc:
                    raise serializers.ValidationError(
                        {"assignment": "Assignment does not exist."}
                    ) from exc
        return data


class AssignmentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), write_only=True, source="user"
    )
    standby_detail = StandbyDetailSerializer(read_only=True)

    class Meta:
        model = Assignment
        fields = ["id", "shift", "user", "user_id", "type", "standby_detail", "created_at"]
        read_only_fields = ["created_at"]
        # Remove default unique validators to allow get_or_create behavior in create()
        validators = []

    def create(self, validated_data: dict[str, Any]) -> Assignment:
        shift = validated_data.get("shift")
        user = validated_data.get("user")
        assignment_type = validated_data.get("type")

        assignment, created = Assignment.objects.get_or_create(
            shift=shift,
            user=user,
            type=assignment_type
        )
        return assignment

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        request = self.context.get("request")
        if request and not request.user.is_admin and not request.user.is_manager:
            target_user = data.get("user")
            if target_user and target_user != request.user:
                raise serializers.ValidationError(
                    {"user_id": "You can only create assignments for yourself."}
                )
        if request and request.user.is_manager and not request.user.is_admin:
            target_user = data.get("user")
            if target_user and target_user.role != request.user.role:
                raise serializers.ValidationError(
                    {"user_id": "You can only assign users in your own domain."}
                )
        return data


class ShiftSerializer(serializers.ModelSerializer):
    technology = TechnologySerializer(read_only=True)
    technology_id = serializers.PrimaryKeyRelatedField(
        queryset=Technology.objects.all(), write_only=True, source="technology"
    )
    assignments = AssignmentSerializer(many=True, read_only=True)
    created_by = UserSerializer(read_only=True)
    auto_populate = serializers.BooleanField(write_only=True, required=False, default=False)

    def validate_notes(self, value: str) -> str:
        value = strip_tags(value) if value else value
        if value and len(value) > MAX_NOTES_LENGTH:
            raise serializers.ValidationError(
                f"Notes must be {MAX_NOTES_LENGTH} characters or fewer (currently {len(value)})."
            )
        return value

    class Meta:
        model = Shift
        fields = [
            "id",
            "date",
            "technology",
            "technology_id",
            "notes",
            "assignments",
            "created_by",
            "created_at",
            "updated_at",
            "auto_populate",
        ]
        read_only_fields = ["created_at", "updated_at", "created_by"]
        # Remove default unique validators to allow update_or_create in create()
        validators = []

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        request = self.context.get("request")
        if request and request.user.is_manager and not request.user.is_admin:
            tech = data.get("technology")
            if tech and tech.role != request.user.role:
                raise serializers.ValidationError(
                    {"technology_id": "You can only manage shifts for technologies in your own domain."}
                )
        return data

    def create(self, validated_data: dict[str, Any]) -> Shift:
        # The frontend might send extra fields that should be popped before creation
        validated_data.pop("assignments", None)
        auto_populate = validated_data.pop("auto_populate", False)

        # Use update_or_create so re-adding a shift for the same (date, technology)
        # updates notes instead of failing with a unique constraint error.
        date = validated_data.pop("date", None)
        technology = validated_data.pop("technology", None)
        defaults = {
            "notes": validated_data.pop("notes", "") or "",
        }
        # created_by is set via perform_create in the view, but preserve it here too.
        if "created_by" in validated_data:
            defaults["created_by"] = validated_data.pop("created_by")
        # Discard any remaining keys so they don't break update_or_create

        shift, created = Shift.objects.update_or_create(
            date=date,
            technology=technology,
            defaults=defaults,
        )

        # Auto-populate default crew members as WORK_HOURS only when a brand-new shift is created
        if created and auto_populate and technology:
            default_crew = UserTechnology.objects.filter(
                technology=technology, is_default=True
            ).select_related("user")
            for ut in default_crew:
                Assignment.objects.get_or_create(
                    shift=shift, user=ut.user, type="WORK_HOURS"
                )

        return shift


class ShiftListSerializer(serializers.ModelSerializer):
    technology = TechnologySerializer(read_only=True)
    assignment_count = serializers.IntegerField(read_only=True)
    has_standby = serializers.BooleanField(read_only=True)

    class Meta:
        model = Shift
        fields = ["id", "date", "technology", "assignment_count", "has_standby", "notes"]


class DefaultCrewSerializer(serializers.ModelSerializer):
    users = serializers.SerializerMethodField()

    class Meta:
        model = Technology
        fields = ["id", "name", "slug", "color_code", "users"]

    def get_users(self, obj: Technology) -> list[dict[str, Any]]:
        default_users = obj.usertechnology_set.filter(is_default=True).select_related("user")
        return UserSerializer(
            [ut.user for ut in default_users],
            many=True,
            context=self.context,
        ).data


class VacationOverlapSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    user_ids = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=True, required=False
    )

    def validate(self, data: dict[str, Any]) -> dict[str, Any]:
        if data["end_date"] < data["start_date"]:
            raise serializers.ValidationError(
                {"end_date": "End date must be after start date."}
            )
        return data

    def get_overlapping(self) -> QuerySet[Vacation]:
        user_ids = self.validated_data.get("user_ids", [])
        queryset = Vacation.objects.filter(
            Q(start_date__lte=self.validated_data["end_date"])
            & Q(end_date__gte=self.validated_data["start_date"])
        )
        if user_ids:
            queryset = queryset.filter(user_id__in=user_ids)
        return queryset.select_related("user")


class CurrentUserSerializer(serializers.ModelSerializer):
    technologies = UserTechnologySerializer(
        source="usertechnology_set", many=True, read_only=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
            "phone_number",
            "is_staff",
            "is_superuser",
            "technologies",
        ]

    def to_representation(self, instance: CustomUser) -> dict[str, Any]:
        data = super().to_representation(instance)
        data["permissions"] = {
            "is_admin": instance.is_admin,
            "is_manager": instance.is_manager,
            "is_read_only": instance.is_read_only,
            "is_siae": instance.is_siae,
            "is_eng": instance.is_eng,
        }
        return data


class SiteSettingsSerializer(serializers.ModelSerializer):
    smtp_password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = SiteSettings
        fields = [
            "id",
            "brand_name",
            "client_role_label",
            "consultant_role_label",
            "smtp_host",
            "smtp_port",
            "smtp_user",
            "smtp_password",
            "smtp_use_tls",
            "smtp_from_email",
            "email_backend",
            "postfix_host",
            "postfix_port",
            "client_email",
            "test_email_recipient",
            "email_template_enabled",
            "email_template_subject",
            "email_template_body",
            "notifications_enabled",
            "notify_on_vacation_change",
            "notify_on_shift_change",
            "anon_throttle_rate",
            "user_throttle_rate",
            "announcement_text",
            "announcement_enabled",
            "announcement_color",
            "jwt_access_minutes",
            "jwt_refresh_days",
        ]

    def update(self, instance: SiteSettings, validated_data: dict[str, Any]) -> SiteSettings:
        from django.core.cache import cache

        from .email import _get_fernet, encrypt_password
        plain = validated_data.pop("smtp_password", None)
        if plain is not None:
            if plain and _get_fernet() is None:
                raise serializers.ValidationError(
                    {
                        "smtp_password": (
                            "DJANGO_FERNET_KEY is not configured. "
                            "Set it before storing passwords."
                        )
                    }
                )
            instance.smtp_password = encrypt_password(plain) if plain else ""
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        cache.delete("site_settings")
        return instance


class SiteSettingsPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = [
            "brand_name",
            "client_role_label",
            "consultant_role_label",
            "announcement_text",
            "announcement_enabled",
            "announcement_color",
        ]
