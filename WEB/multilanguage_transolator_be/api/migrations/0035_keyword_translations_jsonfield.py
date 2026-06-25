"""
Migration: Replace per-language columns with translations JSONField.

Step 1: Add translations JSONField to all 3 models.
Step 2: Data migration — copy existing column data into translations dict.
Step 3: Remove old language columns.
"""
from django.db import migrations, models

FIELD_TO_CODE = {
    'english': 'en',
    'japanese': 'ja',
    'vietnamese': 'vi',
    'chinese_simplified': 'zh-CN',
    'chinese_traditional': 'zh-TW',
    'thai': 'th',
    'bengali': 'bn',
    'hindi': 'hi',
    'indonesian': 'id',
    'oriya': 'or',
}

OLD_FIELDS = list(FIELD_TO_CODE.keys())


def migrate_to_json(apps, schema_editor):
    for model_name in ['PrivateKeyword', 'KeywordSuggestion', 'KeywordQueue']:
        Model = apps.get_model('api', model_name)
        objs = []
        for obj in Model.objects.all():
            translations = {}
            for field, code in FIELD_TO_CODE.items():
                val = getattr(obj, field, None)
                if val and str(val).strip():
                    translations[code] = str(val).strip()
            obj.translations = translations
            objs.append(obj)
        if objs:
            Model.objects.bulk_update(objs, ['translations'], batch_size=500)


def reverse_migrate(apps, schema_editor):
    for model_name in ['PrivateKeyword', 'KeywordSuggestion', 'KeywordQueue']:
        Model = apps.get_model('api', model_name)
        objs = []
        for obj in Model.objects.all():
            t = obj.translations or {}
            for field, code in FIELD_TO_CODE.items():
                setattr(obj, field, t.get(code, ''))
            objs.append(obj)
        if objs:
            Model.objects.bulk_update(objs, OLD_FIELDS, batch_size=500)


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0034_seed_default_company_and_assign_users'),
    ]

    operations = [
        # ── Step 1: Add translations field ──────────────────────────────────
        migrations.AddField(
            model_name='privatekeyword',
            name='translations',
            field=models.JSONField(default=dict, blank=True),
        ),
        migrations.AddField(
            model_name='keywordsuggestion',
            name='translations',
            field=models.JSONField(default=dict, blank=True),
        ),
        migrations.AddField(
            model_name='keywordqueue',
            name='translations',
            field=models.JSONField(default=dict, blank=True),
        ),

        # ── Step 2: Data migration ───────────────────────────────────────────
        migrations.RunPython(migrate_to_json, reverse_code=reverse_migrate),

        # ── Step 3: Remove old language columns ─────────────────────────────
        *[
            migrations.RemoveField(model_name=model, name=field)
            for model in ['privatekeyword', 'keywordsuggestion', 'keywordqueue']
            for field in OLD_FIELDS
        ],
    ]
