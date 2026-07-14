import secrets
import string

from rest_framework import serializers
from django.db import IntegrityError
from api.models.user import CustomUser


def generate_temp_password(length=10):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()
    generated_password = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CustomUser
        fields = ["email", "first_name","last_name" , "password", "role", "department", "generated_password"]
        extra_kwargs = {
            "password": {"write_only": True, "required": False, "allow_null": True, "allow_blank": True}
        }

    def get_generated_password(self, obj):
        # Only set when the caller didn't supply a password themselves (see create()).
        return getattr(self, "_generated_password", None)

    def validate_email(self, value):
        # Case-insensitive uniqueness check to avoid DB IntegrityError
        if CustomUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already exists. Please use another email.")
        return value

    def create(self, validated_data):
        try:
            password = validated_data.get("password") or None
            if not password:
                # Admin-created accounts don't submit a password; generate one so the
                # account has a usable login instead of Django's set_unusable_password().
                password = generate_temp_password()
                self._generated_password = password
            user = CustomUser.objects.create_user(
                email=validated_data["email"],
                first_name=validated_data["first_name"],
                last_name=validated_data["last_name"],
                password=password,
                role=validated_data.get("role", "User"),
                department=validated_data.get("department")
            )
            return user
        except IntegrityError:
            # In case of race condition, surface a clean 400 error
            raise serializers.ValidationError({
                "email": "Email already exists. Please use another email."
            })

class CustomUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'department', 'date_joined', 'is_active']

