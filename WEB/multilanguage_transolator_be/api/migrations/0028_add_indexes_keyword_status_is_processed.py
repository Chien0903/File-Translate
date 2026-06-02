from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0027_library_queue_default_threshold_2'),
    ]

    operations = [
        migrations.AlterField(
            model_name='keywordsuggestion',
            name='status',
            field=models.CharField(
                choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')],
                default='pending',
                db_index=True,
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='keywordqueue',
            name='is_processed',
            field=models.BooleanField(default=False, db_index=True),
        ),
    ]
