from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0030_add_refreshtoken_model'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='customuser',
            name='cognito_sub',
        ),
        migrations.RemoveField(
            model_name='customuser',
            name='auth_provider',
        ),
    ]
