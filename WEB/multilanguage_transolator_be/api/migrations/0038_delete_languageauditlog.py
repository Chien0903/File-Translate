from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0037_alter_keywordsuggestion_frequency_percentage_and_more'),
    ]

    operations = [
        migrations.DeleteModel(
            name='LanguageAuditLog',
        ),
    ]
