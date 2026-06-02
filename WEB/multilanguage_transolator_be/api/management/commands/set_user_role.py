from django.core.management.base import BaseCommand
from api.models.user import CustomUser

class Command(BaseCommand):
    help = 'Set user role (Admin, Library Keeper, User)'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='Email của user')
        parser.add_argument('role', type=str, help='Role mới (Admin, Library Keeper, User)')

    def handle(self, *args, **options):
        email = options['email']
        role = options['role']
        
        valid_roles = ['Admin', 'Library Keeper', 'User']
        if role not in valid_roles:
            self.stdout.write(
                self.style.ERROR(f'Role không hợp lệ. Chọn một trong: {", ".join(valid_roles)}')
            )
            return

        try:
            user = CustomUser.objects.get(email=email)
            old_role = user.role
            user.role = role
            
            # Nếu role là Admin, cũng set is_staff = True
            if role == 'Admin':
                user.is_staff = True
            elif old_role == 'Admin' and role != 'Admin':
                user.is_staff = False
                
            user.save()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Đã cập nhật role cho user {email}: {old_role} → {role}'
                )
            )
            
        except CustomUser.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'❌ Không tìm thấy user với email: {email}')
            ) 