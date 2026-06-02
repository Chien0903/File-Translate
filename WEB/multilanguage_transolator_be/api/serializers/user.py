from rest_framework import serializers
from django.db import IntegrityError
from api.models.user import CustomUser

class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()
    
    class Meta:
        model = CustomUser
        fields = ["email", "first_name","last_name" , "password", "role", "department"]
        extra_kwargs = {
            "password": {"write_only": True, "required": False, "allow_null": True, "allow_blank": True}
        }
    
    def validate_email(self, value):
        # Case-insensitive uniqueness check to avoid DB IntegrityError
        if CustomUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already exists. Please use another email.")
        return value

    def create(self, validated_data):
        try:
            password = validated_data.get("password") or None
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
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'department', 'date_joined']

