from django.db import migrations, models


def create_default_settings(apps, schema_editor):
    SiteSettings = apps.get_model("calendar_app", "SiteSettings")
    SiteSettings.objects.get_or_create(pk=1)


class Migration(migrations.Migration):
    dependencies = [
        ("calendar_app", "0004_alter_assignment_unique_together_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="SiteSettings",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "brand_name",
                    models.CharField(default="Omni Calendar", max_length=100),
                ),
                (
                    "client_role_label",
                    models.CharField(default="Client", max_length=50),
                ),
                (
                    "consultant_role_label",
                    models.CharField(default="Consultant", max_length=50),
                ),
                ("smtp_host", models.CharField(blank=True, max_length=255)),
                ("smtp_port", models.PositiveIntegerField(default=587)),
                ("smtp_user", models.CharField(blank=True, max_length=255)),
                ("smtp_password", models.CharField(blank=True, max_length=500)),
                ("smtp_use_tls", models.BooleanField(default=True)),
                (
                    "smtp_from_email",
                    models.EmailField(default="noreply@omni-calendar.local"),
                ),
                ("notifications_enabled", models.BooleanField(default=False)),
                ("notify_on_vacation_change", models.BooleanField(default=True)),
                ("notify_on_shift_change", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Site Settings",
                "verbose_name_plural": "Site Settings",
            },
        ),
        migrations.RunPython(create_default_settings),
    ]
