from django.db import migrations


def delete_inactive_languages(apps, schema_editor):
    """
    'Tồn tại = dùng được' thay thế cho is_active — ngôn ngữ nào đang tắt
    (chưa từng được bật lại) coi như chưa được thêm, xoá hẳn khỏi hệ thống.
    Ngôn ngữ đang bật (is_active=True) được giữ nguyên.
    """
    Language = apps.get_model('api', 'Language')
    Language.objects.filter(is_active=False).delete()


def noop_reverse(apps, schema_editor):
    # Không thể khôi phục lại các ngôn ngữ đã xoá — rollback chỉ khôi phục field.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0040_remove_company_models'),
    ]

    operations = [
        migrations.RunPython(delete_inactive_languages, noop_reverse),
        migrations.RemoveField(
            model_name='language',
            name='is_active',
        ),
    ]
