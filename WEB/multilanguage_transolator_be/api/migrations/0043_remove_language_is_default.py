from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0042_fixed_four_languages'),
    ]

    operations = [
        migrations.RunSQL(
            sql="DROP INDEX IF EXISTS unique_default_language;",
            reverse_sql="""
                CREATE UNIQUE INDEX unique_default_language
                ON api_language (is_default)
                WHERE is_default = TRUE;
            """,
        ),
        migrations.RemoveField(
            model_name='language',
            name='is_default',
        ),
    ]
