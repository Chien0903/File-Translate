from django.db import migrations


class Migration(migrations.Migration):
    """
    Remove PasswordResetToken (never had an API endpoint) and
    CustomUser.preferred_language (defined but never read or written by any view).
    """

    dependencies = [
        ('api', '0035_keyword_translations_jsonfield'),
    ]

    operations = [
        migrations.DeleteModel(
            name='PasswordResetToken',
        ),
        migrations.RemoveField(
            model_name='customuser',
            name='preferred_language',
        ),
    ]
