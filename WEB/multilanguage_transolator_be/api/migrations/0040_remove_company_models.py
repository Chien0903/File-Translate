from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0039_language_is_default'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='customuser',
            name='company',
        ),
        migrations.DeleteModel(
            name='CompanyLanguage',
        ),
        migrations.DeleteModel(
            name='Company',
        ),
        migrations.RunSQL(
            sql="""
                CREATE UNIQUE INDEX unique_default_language
                ON api_language (is_default)
                WHERE is_default = TRUE;
            """,
            reverse_sql="DROP INDEX IF EXISTS unique_default_language;",
        ),
    ]
