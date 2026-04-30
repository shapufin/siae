"""Django signals for sending email notifications via SMTP."""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Assignment, Shift, Vacation
from .services import NotificationService


@receiver(post_save, sender=Vacation)
def vacation_notification(sender, instance, created, **kwargs):
    action = "created" if created else "updated"
    NotificationService.send_vacation_notification(instance, action)


@receiver(post_delete, sender=Vacation)
def vacation_delete_notification(sender, instance, **kwargs):
    NotificationService.send_vacation_notification(instance, "deleted")


@receiver(post_save, sender=Assignment)
def assignment_notification(sender, instance, created, **kwargs):
    action = "assigned" if created else "updated"
    NotificationService.send_assignment_notification(instance, action)


@receiver(post_delete, sender=Assignment)
def assignment_delete_notification(sender, instance, **kwargs):
    # Cleanup empty shift — guard against bulk-delete scenarios
    try:
        shift = instance.shift
    except Shift.DoesNotExist:
        shift = None

    if shift and not shift.assignments.exists():
        shift.delete()

    NotificationService.send_assignment_notification(instance, "removed")

