import logging
from .email import send_smtp_email
from .models import CustomUser, SiteSettings, Vacation, Assignment
from .email_templates import render_vacation_notification_html

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
            logger.debug("Vacation notifications disabled in settings.")
            return

        user_name = vacation.user.get_full_name() or vacation.user.username
        
        # 1. Internal Notifications (notify opposite role)
        recipients = cls._get_opposite_role_recipients(vacation.user)
        if recipients:
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
                logger.info(f"Internal vacation notification ({action}) sent for user {vacation.user.username} to {len(recipients)} recipients")
            except Exception as e:
                logger.error(f"Failed to send internal vacation notification: {e}")
        else:
            logger.info(f"No internal recipients found for vacation notification of user {vacation.user.username}")

        # 2. Client notification for ENG (Consultant) users
        if vacation.user.role == "ENG" and conf.client_email:
            first_name = vacation.user.first_name or ""
            last_name = vacation.user.last_name or ""
            
            tech_obj = vacation.user.default_technology
            technology = tech_obj.name if tech_obj else "N/A"
            
            # Use custom template if enabled
            custom_template = conf.email_template_body if conf.email_template_enabled else ""
            
            html_body = render_vacation_notification_html(
                brand_name=conf.brand_name,
                first_name=first_name,
                last_name=last_name,
                technology=technology,
                vacation_type=vacation.get_type_display(),
                start_date=str(vacation.start_date),
                end_date=str(vacation.end_date),
                custom_template=custom_template,
            )
            
            # Use custom subject if enabled, otherwise default
            if conf.email_template_enabled and conf.email_template_subject:
                client_subject = conf.email_template_subject.replace("{brand_name}", conf.brand_name).replace("{first_name}", first_name).replace("{last_name}", last_name)
            else:
                client_subject = f"[{conf.brand_name}] Consultant Vacation Notification: {user_name}"
            
            try:
                # Send HTML email to client
                send_smtp_email(client_subject, "", [conf.client_email], html_body=html_body)
                logger.info(f"Client vacation notification sent for user {vacation.user.username} to {conf.client_email}")
            except Exception as e:
                logger.error(f"Failed to send client vacation notification: {e}")

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
