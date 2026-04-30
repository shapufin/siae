import logging
from .email import send_smtp_email
from .models import CustomUser, SiteSettings, Vacation, Assignment

logger = logging.getLogger(__name__)

class NotificationService:
    """Centralized service for handling application notifications."""

    @staticmethod
    def _get_opposite_role_recipients(user: CustomUser) -> list[str]:
        """ENG changes notify SIAE; SIAE changes notify ENG. Admin/CR changes notify both."""
        if user.role in ("ENG", "SIAE"):
            opposite = "SIAE" if user.role == "ENG" else "ENG"
            return list(
                CustomUser.objects.filter(role=opposite, is_active=True)
                .exclude(email="")
                .values_list("email", flat=True)
            )
        return list(
            CustomUser.objects.filter(role__in=("ENG", "SIAE"), is_active=True)
            .exclude(email="")
            .values_list("email", flat=True)
        )

    @classmethod
    def send_vacation_notification(cls, vacation: Vacation, action: str):
        conf = SiteSettings.load()
        if not conf.notifications_enabled or not conf.notify_on_vacation_change:
            return

        recipients = cls._get_opposite_role_recipients(vacation.user)
        if not recipients:
            return

        user_name = vacation.user.get_full_name() or vacation.user.username
        subject = f"[{conf.brand_name}] Vacation Updated: {user_name} ({action})"
        body = (
            f"Vacation update in {conf.brand_name}\n\n"
            f"User: {user_name}\n"
            f"Period: {vacation.start_date} to {vacation.end_date}\n"
            f"Type: {vacation.get_type_display()}\n"
            f"Action: {action}"
        )
        
        try:
            send_smtp_email(subject, body, recipients)
            logger.info(f"Vacation notification ({action}) sent for user {vacation.user.username}")
        except Exception as e:
            logger.error(f"Failed to send vacation notification: {e}")

    @classmethod
    def send_assignment_notification(cls, assignment: Assignment, action: str):
        conf = SiteSettings.load()
        if not conf.notifications_enabled or not conf.notify_on_shift_change:
            return

        recipients = cls._get_opposite_role_recipients(assignment.user)
        if not recipients:
            return

        shift = assignment.shift
        user_name = assignment.user.get_full_name() or assignment.user.username
        subject = f"[{conf.brand_name}] Shift Assignment Updated ({action})"
        body = (
            f"Assignment update in {conf.brand_name}\n\n"
            f"User: {user_name}\n"
            f"Date: {shift.date}\n"
            f"Technology: {shift.technology.name}\n"
            f"Type: {assignment.get_type_display()}\n"
            f"Action: {action}"
        )

        try:
            send_smtp_email(subject, body, recipients)
            logger.info(f"Assignment notification ({action}) sent for user {assignment.user.username}")
        except Exception as e:
            logger.error(f"Failed to send assignment notification: {e}")
