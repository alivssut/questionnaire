from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import EmailVerificationToken, User


class CustomUserCreationForm(forms.ModelForm):
    password1 = forms.CharField(widget=forms.PasswordInput, label="Password")
    password2 = forms.CharField(widget=forms.PasswordInput, label="Password confirmation")

    class Meta:
        model = User
        fields = (
            "email", "first_name", "last_name",
            "is_active", "is_staff", "is_superuser", "is_verified",
        )

    def clean_email(self):
        return self.cleaned_data["email"].strip().lower()

    def clean(self):
        cleaned = super().clean()
        p1, p2 = cleaned.get("password1"), cleaned.get("password2")
        if p1 and p2 and p1 != p2:
            self.add_error("password2", "Passwords do not match.")
        return cleaned

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        if commit:
            user.save()
        return user


class CustomUserChangeForm(forms.ModelForm):
    class Meta:
        model = User
        fields = "__all__"

    def clean_email(self):
        return self.cleaned_data["email"].strip().lower()


class VerificationTokenInline(admin.TabularInline):
    model = EmailVerificationToken
    extra = 0
    readonly_fields = ("token", "expires_at", "used_at", "created_at")
    can_delete = True


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    add_form = CustomUserCreationForm
    form = CustomUserChangeForm
    model = User

    list_display = (
        "email", "first_name", "last_name",
        "is_active", "is_staff", "is_superuser", "is_verified", "created_at",
    )
    list_filter = ("is_active", "is_staff", "is_superuser", "is_verified")
    search_fields = ("email", "first_name", "last_name")
    ordering = ("-created_at",)
    readonly_fields = ("last_login", "created_at", "updated_at")
    inlines = [VerificationTokenInline]

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "avatar")}),
        ("Permissions", {
            "fields": (
                "is_active", "is_staff", "is_superuser", "is_verified",
                "groups", "user_permissions",
            ),
            "description": (
                "Grant `q_accounts | user | Can create surveys` to let a "
                "non-superuser build surveys. Permissions can also come from Groups."
            ),
        }),
        ("Timestamps", {"fields": ("last_login", "created_at", "updated_at")}),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": (
                "email", "first_name", "last_name",
                "password1", "password2",
                "is_active", "is_staff", "is_superuser", "is_verified",
            ),
        }),
    )