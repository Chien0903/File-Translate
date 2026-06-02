# Generated migration file for adding 'rejected' status to KeywordSuggestion

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0018_customuser_auth_provider_customuser_cognito_sub'),
    ]

    operations = [
        migrations.AlterField(
            model_name='keywordsuggestion',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected')
                ],
                default='pending',
                max_length=20
            ),
        ),
    ]

