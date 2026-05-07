"""SMTP email utility with Fernet-encrypted password storage."""

import logging
import os

from cryptography.fernet import Fernet
from django.conf import settings
from django.core.mail import EmailMessage, get_connection

from .models import SiteSettings

logger = logging.getLogger(__name__)


def _get_fernet() -> Fernet | None:
    key = os.getenv("DJANGO_FERNET_KEY", "")
    if not key:
        return None
    try:
        # Fernet requires 32 url-safe base64-encoded bytes (44 characters)
        if len(key) != 44:
            return None
        return Fernet(key.encode())
    except Exception as e:
        logger.error(f"Error initializing Fernet: {e}")
        return None


def encrypt_password(plain: str) -> str:
    if not plain:
        return ""
    f = _get_fernet()
    if f is None:
        return ""
    return f.encrypt(plain.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    if not encrypted:
        return ""
    f = _get_fernet()
    if f is None:
        return ""
    try:
        return f.decrypt(encrypted.encode()).decode()
    except Exception as e:
        logger.error(f"Error decrypting password: {e}")
        return ""


def send_smtp_email(
    subject: str,
    body: str,
    to_emails: list[str],
    html_body: str | None = None,
    force: bool = False,
    backend_override: str | None = None,
) -> int:
    """Send email using configured backend (SMTP or Postfix). Falls back to console if misconfigured."""
    conf = SiteSettings.load()
    if not conf.notifications_enabled and not force:
        return 0

    target_backend = backend_override or conf.email_backend

    if target_backend == "postfix":
        # Use local Postfix
        connection = get_connection(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host=conf.postfix_host or "host.docker.internal",
            port=conf.postfix_port or 25,
            use_tls=False,
            username=None,
            password=None,
        )
    else:
        # Use external SMTP
        if not (conf.smtp_host and conf.smtp_user and conf.smtp_password):
            # Fallback to console backend for local dev
            connection = get_connection(backend="django.core.mail.backends.console.EmailBackend")
        else:
            password = decrypt_password(conf.smtp_password)
            if not password:
                connection = get_connection(backend="django.core.mail.backends.console.EmailBackend")
            else:
                connection = get_connection(
                    backend="django.core.mail.backends.smtp.EmailBackend",
                    host=conf.smtp_host,
                    port=conf.smtp_port,
                    username=conf.smtp_user,
                    password=password,
                    use_tls=conf.smtp_use_tls,
                )

    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=conf.smtp_from_email or settings.DEFAULT_FROM_EMAIL,
        to=to_emails,
        connection=connection,
    )
    if html_body:
        msg.content_subtype = "html"
    return msg.send()
