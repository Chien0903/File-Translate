from django.db import migrations, models


def migrate_enabled_and_default(apps, schema_editor):
    Language = apps.get_model('api', 'Language')
    CompanyLanguage = apps.get_model('api', 'CompanyLanguage')

    for language in Language.objects.all():
        cl = CompanyLanguage.objects.filter(language=language).order_by('-is_default', '-is_enabled').first()
        language.is_active = bool(cl and cl.is_enabled)
        language.is_default = bool(cl and cl.is_default)
        language.save(update_fields=['is_active', 'is_default'])


def reverse_migrate(apps, schema_editor):
    Language = apps.get_model('api', 'Language')
    Language.objects.update(is_default=False)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0038_delete_languageauditlog'),
    ]

    operations = [
        migrations.AddField(
            model_name='language',
            name='is_default',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(migrate_enabled_and_default, reverse_migrate),
    ]
