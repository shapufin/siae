# SMTP & Encryption Setup for Docker

## Required Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DJANGO_FERNET_KEY` | **Yes** (for encrypted SMTP) | *(empty)* | 32-byte URL-safe base64 key for Fernet encryption of the SMTP password stored in the database. |
| `DJANGO_SECRET_KEY` | Yes | `replace-me-in-production` | Standard Django secret key. |
| `EMAIL_BACKEND` | No | `console` | Override email backend. Only needed for debugging; production uses DB-configured SMTP. |

## Generating a Fernet Key

Run once before first `docker compose up`:

```bash
# Using the project's Python environment
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy the output (e.g., `sOmE32CharBase64EncodedKey==`) into your `.env` file:

```bash
DJANGO_FERNET_KEY=sOmE32CharBase64EncodedKey==
```

**If this variable is missing or invalid:**
- The application **will not crash**.
- Saving an SMTP password in the admin UI returns a validation error.
- Encrypted passwords already in the database decrypt to an empty string (graceful degradation).
- Email falls back to Django's `console.EmailBackend` (logs to stdout).

## Docker Compose Integration

`docker-compose.yml` already references the variable:

```yaml
services:
  web:
    environment:
      DJANGO_FERNET_KEY: ${DJANGO_FERNET_KEY:-}
```

Pass it via shell export or an `.env` file in the project root:

```bash
docker compose --env-file .env up
```

## Admin UI Configuration (Post-Launch)

1. Log in as a **superuser**.
2. Navigate to **Admin Dashboard → Settings** tab.
3. Fill SMTP fields:
   - **Host**, **Port**, **User**, **Password**
   - **Use TLS** (recommended)
   - **From Email**
4. Toggle **Notifications Enabled**.
5. Click **Send Test Email** to verify connectivity before saving.

The SMTP password is encrypted at rest using `DJANGO_FERNET_KEY`.

## Security Notes

- **Never commit `DJANGO_FERNET_KEY` to Git.** Add it to `.env` and `.gitignore`.
- Rotating the key requires re-entering the SMTP password in the admin UI; existing encrypted values become undecryptable and fall back to empty.
- The key must be exactly 32 URL-safe base64 bytes. The code auto-pads short keys with `=` for convenience, but generating a proper key is strongly recommended.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Check SMTP settings" on test email | Missing host/user or bad credentials | Verify SMTP config in Settings tab. |
| Validation error saving password | `DJANGO_FERNET_KEY` unset | Set the env var and restart the container. |
| No emails sent, no error | `notifications_enabled` is `False` | Toggle in Settings tab. |
| Emails logged to stdout only | `smtp_password` decrypts empty (key rotation/missing) | Re-save password with a valid `DJANGO_FERNET_KEY`. |
