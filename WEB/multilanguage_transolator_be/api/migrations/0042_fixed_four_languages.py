from django.db import migrations


def seed_chinese(apps, schema_editor):
    """
    Hệ thống giờ cố định đúng 4 ngôn ngữ: English, Japanese, Vietnamese,
    Chinese — không còn tính năng Add/Remove trên UI. vi/ja/en đã tồn tại,
    chỉ cần thêm lại Chinese (zh-CN) nếu chưa có.
    """
    Language = apps.get_model('api', 'Language')
    Language.objects.get_or_create(
        code='zh-CN',
        defaults={
            'name': 'Chinese',
            'native_name': '中文',
            'flag_emoji': '🇨🇳',
            'sort_order': 4,
        },
    )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0041_remove_language_is_active'),
    ]

    operations = [
        migrations.RunPython(seed_chinese, noop_reverse),
    ]
