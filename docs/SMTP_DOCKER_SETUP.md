# Email Configuration (SMTP & Postfix)

The application supports two email backends: **External SMTP** and **Local Postfix**. You can switch between them in the Admin Dashboard.

## Required Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DJANGO_FERNET_KEY` | **Yes** (for SMTP) | *(empty)* | 32-byte URL-safe base64 key for Fernet encryption of the SMTP password. |
| `DJANGO_SECRET_KEY` | Yes | `replace-me-in-production` | Standard Django secret key. |
| `EMAIL_BACKEND` | No | `console` | Override email backend for debugging. |

## Generating a Fernet Key (Required for SMTP)

Run once before first `docker compose up`:

```bash
# Using the project's Python environment
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy the output (e.g., `sOmE32CharBase64EncodedKey==`) into your `.env` file:

```bash
DJANGO_FERNET_KEY=sOmE32CharBase64EncodedKey==
```

## Docker Compose Integration (Required for Postfix)

To allow the Docker container to communicate with the host's Postfix service, `docker-compose.yml` includes an `extra_hosts` mapping:

```yaml
services:
  web:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

This maps `host.docker.internal` to the host's IP address within the container.

## Admin UI Configuration

1. Log in as a **superuser**.
2. Navigate to **Admin Dashboard → Settings** tab.
3. In the **Email Configuration** section, select your **Active Backend**.

### Option A: SMTP (External Server)
- **Host**, **Port**, **User**, **Password**, **Use TLS**.
- Recommended for Gmail, SendGrid, Office365, etc.
- Password is encrypted at rest using `DJANGO_FERNET_KEY`.

### Option B: Postfix (Local Relay)
- **Postfix Host**: Usually `host.docker.internal`.
- **Postfix Port**: Usually `25`.
- Uses the mail service running on the host machine. No authentication is typically required for local relay.

### Shared Settings
- **From Email**: The address shown as the sender.
- **Notifications Enabled**: Global toggle for all automated emails.

4. Click **Send Test Email** to verify connectivity before saving.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Check settings" on test email | Bad credentials or unreachable host | Verify Host/Port and network access. |
| Validation error saving SMTP | `DJANGO_FERNET_KEY` unset | Set the env var and restart the container. |
| Postfix connection timeout | Firewall or incorrect host | Ensure port 25 is open on host and Host matches `host.docker.internal`. |
| No emails sent, no error | `notifications_enabled` is `False` | Toggle in Settings tab. |
