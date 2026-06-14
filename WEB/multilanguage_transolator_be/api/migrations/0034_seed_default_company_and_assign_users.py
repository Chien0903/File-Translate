from django.db import migrations

DEFAULT_COMPANY_NAME = "Toray"
DEFAULT_COMPANY_SLUG = "toray"


def seed_company_and_assign(apps, schema_editor):
    Company = apps.get_model('api', 'Company')
    Language = apps.get_model('api', 'Language')
    CompanyLanguage = apps.get_model('api', 'CompanyLanguage')
    CustomUser = apps.get_model('api', 'CustomUser')

    # 1. Tạo company mặc định
    company, _ = Company.objects.get_or_create(
        slug=DEFAULT_COMPANY_SLUG,
        defaults={'name': DEFAULT_COMPANY_NAME, 'is_active': True},
    )

    # 2. Kích hoạt tất cả ngôn ngữ cho company, Japanese là default
    for lang in Language.objects.all().order_by('sort_order'):
        CompanyLanguage.objects.get_or_create(
            company=company,
            language=lang,
            defaults={
                'is_enabled': True,
                'is_default': (lang.code == 'ja'),
            },
        )

    # 3. Gán tất cả user hiện tại vào company
    CustomUser.objects.filter(company__isnull=True).update(company=company)


def unseed_company_and_assign(apps, schema_editor):
    Company = apps.get_model('api', 'Company')
    CustomUser = apps.get_model('api', 'CustomUser')
    CustomUser.objects.all().update(company=None)
    Company.objects.filter(slug=DEFAULT_COMPANY_SLUG).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0033_seed_initial_languages'),
    ]

    operations = [
        migrations.RunPython(seed_company_and_assign, reverse_code=unseed_company_and_assign),
    ]
