import logging

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema
from rest_framework import filters, generics, permissions, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken

from apps.q_accounts.models import EmailVerificationToken, User
from apps.q_core.permissions import IsSuperUser

from .serializers import (
    AdminUserSerializer,
    ChangePasswordSerializer,
    EmailVerificationConfirmSerializer,
    LoginSerializer,
    MeUpdateSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


class LoginThrottle(AnonRateThrottle):
    scope = "login"


def _issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def _touch_last_login(user):
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])


def _blacklist_all_for(user):
    outstanding = list(OutstandingToken.objects.filter(user=user))
    if not outstanding:
        return
    BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token=t) for t in outstanding],
        ignore_conflicts=True,
    )


def _send_verification_email(user):
    EmailVerificationToken.objects.filter(
        user=user, used_at__isnull=True,
    ).update(used_at=timezone.now())

    token = EmailVerificationToken.issue(user)
    link = f"{settings.FRONTEND_URL}/verify-email?token={token.token}"
    send_mail(
        subject="Verify your FORMly email",
        message=f"Open this link to verify your account:\n{link}",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=True,
    )
    return token


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginThrottle]

    def create(self, request, *args, **kwargs):
        if not settings.ALLOW_PUBLIC_REGISTRATION:
            return Response(
                {"detail": "Public registration is disabled."},
                status=status.HTTP_403_FORBIDDEN,
            )

        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()
        _touch_last_login(user)

        if settings.EMAIL_VERIFICATION_ENABLED:
            _send_verification_email(user)

        payload = {"user": UserSerializer(user).data}
        if not settings.REQUIRE_VERIFIED_TO_LOGIN:
            payload.update(_issue_tokens(user))
        return Response(payload, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginThrottle]
    serializer_class = LoginSerializer

    @extend_schema(request=LoginSerializer)
    def post(self, request):
        s = LoginSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        user = s.validated_data["user"]

        if settings.REQUIRE_VERIFIED_TO_LOGIN and not user.is_verified:
            return Response(
                {"detail": "Email is not verified.", "code": "email_not_verified"},
                status=status.HTTP_403_FORBIDDEN,
            )

        _touch_last_login(user)
        return Response({"user": UserSerializer(user).data, **_issue_tokens(user)})


class LogoutView(APIView):
    def post(self, request):
        token = request.data.get("refresh")
        if token:
            try:
                RefreshToken(token).blacklist()
            except Exception:
                pass
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return MeUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        s = MeUpdateSerializer(instance, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(UserSerializer(instance).data)


class ChangePasswordView(APIView):
    def post(self, request):
        s = ChangePasswordSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        user = s.save()
        _blacklist_all_for(user)
        return Response({"detail": "Password updated. Please log in again."})


class PasswordResetRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        s = PasswordResetRequestSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = User.objects.filter(
            email__iexact=s.validated_data["email"].strip().lower(),
            is_active=True,
        ).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            send_mail(
                subject="Password reset",
                message=f"Reset your password:\n{reset_url}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        return Response({"detail": "If the email exists, a reset link was sent."})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = PasswordResetConfirmSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            pk = force_str(urlsafe_base64_decode(s.validated_data["uid"]))
            user = User.objects.get(pk=pk)
        except Exception:
            return Response({"detail": "Invalid token."}, status=400)
        if not default_token_generator.check_token(user, s.validated_data["token"]):
            return Response({"detail": "Invalid token."}, status=400)
        user.set_password(s.validated_data["new_password"])
        user.save(update_fields=["password", "updated_at"])
        _blacklist_all_for(user)
        return Response({"detail": "Password reset complete."})


class EmailVerificationRequestView(APIView):
    throttle_classes = [LoginThrottle]

    def post(self, request):
        if not settings.EMAIL_VERIFICATION_ENABLED:
            return Response(
                {"detail": "Email verification is disabled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        if user.is_verified:
            return Response({"detail": "Already verified."})
        _send_verification_email(user)
        return Response({"detail": "Verification email sent."})


class EmailVerificationConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        if not settings.EMAIL_VERIFICATION_ENABLED:
            return Response(
                {"detail": "Email verification is disabled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        s = EmailVerificationConfirmSerializer(data=request.data)
        s.is_valid(raise_exception=True)

        try:
            vt = EmailVerificationToken.objects.select_related("user").get(
                token=s.validated_data["token"],
            )
        except EmailVerificationToken.DoesNotExist:
            return Response({"detail": "Invalid token."}, status=400)

        if not vt.is_valid():
            return Response({"detail": "Token expired or already used."}, status=400)

        user = vt.user
        with transaction.atomic():
            if vt.consume():
                user.is_verified = True
                user.save(update_fields=["is_verified", "updated_at"])
        return Response({"detail": "Email verified."})


class AdminUserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("-created_at")
    serializer_class = AdminUserSerializer
    permission_classes = [IsSuperUser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["is_active", "is_staff", "is_superuser", "is_verified"]
    search_fields = ["email", "first_name", "last_name"]
    ordering_fields = ["created_at", "last_login", "email"]

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .prefetch_related("user_permissions", "groups")
        )

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response(
                {"detail": "You cannot deactivate your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = False
        user.save(update_fields=["is_active", "updated_at"])
        _blacklist_all_for(user)
        return Response(status=status.HTTP_204_NO_CONTENT)