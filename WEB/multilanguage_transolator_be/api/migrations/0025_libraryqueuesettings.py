from django.db import migrations, models


def seed_settings(apps, schema_editor):
    LibraryQueueSettings = apps.get_model('api', 'LibraryQueueSettings')
    LibraryQueueSettings.objects.get_or_create(
        pk=1,
        defaults={'min_suggesters_for_queue': 2},
    )


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0024_private_keyword_suggestion_link'),
    ]

    operations = [
        migrations.CreateModel(
            name='LibraryQueueSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('min_suggesters_for_queue', models.PositiveIntegerField(default=2, help_text='Tối thiểu số người đề xuất khác nhau (cùng nội dung) để từ vào hàng chờ')),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Library queue settings',
                'verbose_name_plural': 'Library queue settings',
            },
        ),
        migrations.RunPython(seed_settings, migrations.RunPython.noop),
    ]
