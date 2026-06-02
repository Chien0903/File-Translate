from django.db import migrations, models


def set_threshold_two(apps, schema_editor):
    LibraryQueueSettings = apps.get_model("api", "LibraryQueueSettings")
    LibraryQueueSettings.objects.filter(pk=1).update(min_suggesters_for_queue=2)


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0026_alter_libraryqueue_min_suggesters_default"),
    ]

    operations = [
        migrations.AlterField(
            model_name="libraryqueuesettings",
            name="min_suggesters_for_queue",
            field=models.PositiveIntegerField(
                default=2,
                help_text="Tối thiểu số người đề xuất khác nhau (cùng khóa gom nhóm) để từ vào hàng chờ",
            ),
        ),
        migrations.RunPython(set_threshold_two, migrations.RunPython.noop),
    ]
