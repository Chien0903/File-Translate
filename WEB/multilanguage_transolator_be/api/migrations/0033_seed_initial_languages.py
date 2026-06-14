from django.db import migrations

INITIAL_LANGUAGES = [
    # (code, name, native_name, flag_emoji, sort_order)
    ('vi',    'Vietnamese',           'Tiếng Việt',        '🇻🇳', 1),
    ('ja',    'Japanese',             '日本語',             '🇯🇵', 2),
    ('en',    'English',              'English',            '🇬🇧', 3),
    ('zh-CN', 'Chinese (Simplified)', '简体中文',           '🇨🇳', 4),
    ('zh-TW', 'Chinese (Traditional)','繁體中文',           '🇹🇼', 5),
    ('th',    'Thai',                 'ภาษาไทย',           '🇹🇭', 6),
    ('bn',    'Bengali',              'বাংলা',              '🇧🇩', 7),
    ('hi',    'Hindi',                'हिन्दी',            '🇮🇳', 8),
    ('id',    'Indonesian',           'Bahasa Indonesia',   '🇮🇩', 9),
    ('or',    'Oriya',                'ଓଡ଼ିଆ',             '🇮🇳', 10),
]


def seed_languages(apps, schema_editor):
    Language = apps.get_model('api', 'Language')
    for code, name, native_name, flag_emoji, sort_order in INITIAL_LANGUAGES:
        Language.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'native_name': native_name,
                'flag_emoji': flag_emoji,
                'sort_order': sort_order,
                'is_active': True,
            }
        )


def unseed_languages(apps, schema_editor):
    Language = apps.get_model('api', 'Language')
    codes = [row[0] for row in INITIAL_LANGUAGES]
    Language.objects.filter(code__in=codes).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0032_add_language_company_models'),
    ]

    operations = [
        migrations.RunPython(seed_languages, reverse_code=unseed_languages),
    ]
