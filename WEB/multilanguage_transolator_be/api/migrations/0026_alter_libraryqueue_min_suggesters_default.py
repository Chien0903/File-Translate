from django.db import migrations, models


def set_min_suggesters_to_one(apps, schema_editor):
    LibraryQueueSettings = apps.get_model("api", "LibraryQueueSettings")
    LibraryQueueSettings.objects.filter(pk=1).update(min_suggesters_for_queue=1)


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0025_libraryqueuesettings"),
    ]

    operations = [
        migrations.AlterField(
            model_name="libraryqueuesettings",
            name="min_suggesters_for_queue",
            field=models.PositiveIntegerField(
                default=1,
                help_text="Tối thiểu số người đề xuất khác nhau (cùng khóa gom nhóm) để từ vào hàng chờ",
            ),
        ),
        migrations.RunPython(set_min_suggesters_to_one, migrations.RunPython.noop),
    ]
