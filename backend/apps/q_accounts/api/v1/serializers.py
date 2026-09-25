from django.contrib.auth import authenticate
from django.contrib.auth.models import Permission
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.q_core.validators import validate_upload
from apps.q_accounts.models import User

CUSTOM_APP_LABEL = "q_accounts"
CUSTOM_PERMISSION_CODENAMES = frozenset({"can_create_survey"})


def _custom_perms(all_perm_strings) -> list[str]:
    return sorted(
        p.split(".", 1)[1]
        for p in all_perm_strings
        if p.startswith(f"{CUSTOM_APP_LABEL}.")
        and p.split(".", 1)[1] in CUSTOM_PERMISSION_CODENAMES
    )


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    permissions = serializers.SerializerMethodField()
    is_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "avatar",
            "is_active", "is_admin", "is_verified",
            "full_name", "permissions",
            "notification_preferences",
            "created_at", "updated_at", "last_login",
        ]
        read_only_fields = fields

    def get_permissions(self, obj):
        return _custom_perms(obj.get_all_permissions())


class MeUpdateSerializer(serializers.ModelSerializer):
    avatar = serializers.ImageField(required=False, validators=[validate_upload])
    notification_preferences = serializers.JSONField(required=False)

    class Meta:
        model = User
        fields = ["first_name", "last_name", "avatar", "notification_preferences"]

    def validate_first_name(self, v):
        return v.strip()

    def validate_last_name(self, v):
        return v.strip()

    def validate_notification_preferences(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                "notification_preferences must be an object."
            )
        allowed = {"email", "assignments", "reminders", "completions"}
        unknown = set(value.keys()) - allowed
        if unknown:
            raise serializers.ValidationError(
                f"Unknown keys: {sorted(unknown)}. Allowed: {sorted(allowed)}"
            )
        # Force every key to be a bool with a stable shape
        return {k: bool(value.get(k, False)) for k in allowed}


class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    permissions = serializers.ListField(
        child=serializers.CharField(), required=False, default=list,
    )
    is_admin = serializers.BooleanField(required=False)
    full_name = serializers.CharField(read_only=True)
    effective_permissions = serializers.SerializerMethodField()
    groups = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "avatar",
            "is_active", "is_admin", "is_verified",
            "password", "permissions", "effective_permissions", "groups",
            "full_name", "created_at", "updated_at", "last_login",
        ]
        read_only_fields = [
            "id", "created_at", "updated_at", "last_login",
            "full_name", "effective_permissions", "groups",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["is_admin"] = bool(instance.is_superuser)
        data["permissions"] = _custom_perms(
            f"{CUSTOM_APP_LABEL}.{c}" for c in instance.user_permissions.values_list(
                "codename", flat=True,
            )
        )
        return data

    def get_effective_permissions(self, obj):
        return _custom_perms(obj.get_all_permissions())

    def get_groups(self, obj):
        return sorted(obj.groups.values_list("name", flat=True))

    def validate_permissions(self, value):
        invalid = set(value) - CUSTOM_PERMISSION_CODENAMES
        if invalid:
            raise serializers.ValidationError(
                f"Unknown permission(s): {sorted(invalid)}. "
                f"Allowed: {sorted(CUSTOM_PERMISSION_CODENAMES)}"
            )
        return list(set(value))

    def validate_email(self, value):
        value = value.strip().lower()
        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        if not request or not self.instance:
            return attrs
        if self.instance.pk == request.user.pk:
            if attrs.get("is_admin") is False:
                raise serializers.ValidationError(
                    {"is_admin": "You cannot remove your own admin status."}
                )
            if attrs.get("is_active") is False:
                raise serializers.ValidationError(
                    {"is_active": "You cannot deactivate your own account."}
                )
        return attrs

    def _apply_direct_permissions(self, user, codenames):
        perms = Permission.objects.filter(
            content_type__app_label=CUSTOM_APP_LABEL,
            codename__in=codenames,
        )
        user.user_permissions.set(perms)

    def _apply_admin_flag(self, instance, is_admin):
        if is_admin is None:
            return
        instance.is_staff = bool(is_admin)
        instance.is_superuser = bool(is_admin)

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        permission_codenames = validated_data.pop("permissions", [])
        is_admin = validated_data.pop("is_admin", False)

        user = User.objects.create_user(password=password, **validated_data)
        self._apply_admin_flag(user, is_admin)
        user.save(update_fields=["is_staff", "is_superuser"])
        self._apply_direct_permissions(user, permission_codenames)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        permission_codenames = validated_data.pop("permissions", None)
        is_admin = validated_data.pop("is_admin", None)

        for k, v in validated_data.items():
            setattr(instance, k, v)
        if password:
            instance.set_password(password)
        self._apply_admin_flag(instance, is_admin)
        instance.save()

        if permission_codenames is not None:
            self._apply_direct_permissions(instance, permission_codenames)
        return instance


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "password", "password2"]

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password2"):
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["email"].strip().lower(),
            password=attrs["password"],
        )
        if not user:
            raise serializers.ValidationError({"detail": "Invalid credentials."})
        if not user.is_active:
            raise serializers.ValidationError({"detail": "Account is inactive."})
        attrs["user"] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Incorrect password.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password", "updated_at"])
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])


class EmailVerificationConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    

class UserSummarySerializer(serializers.ModelSerializer):
    """
    Lightweight user representation for embedding in nested responses
    (assignments, activity logs, response details, etc.).

    Omits `permissions`, `notification_preferences`, and timestamps.
    This avoids one DB query per user for `get_all_permissions()` — the
    single biggest source of N+1 in list endpoints that embed users.

    `full_name` and `is_admin` are model properties (no DB hit).
    """
    full_name = serializers.CharField(read_only=True)
    is_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name",
            "full_name", "avatar", "is_active", "is_admin",
        ]
        read_only_fields = fields