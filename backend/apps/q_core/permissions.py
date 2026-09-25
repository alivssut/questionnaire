from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsSuperUser(BasePermission):
    message = "Only superusers can perform this action."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.is_superuser)


class CanCreateSurvey(BasePermission):
    """
    Superuser OR user with `q_accounts.can_create_survey` permission
    (direct or via group).
    """

    message = "You need the `can_create_survey` permission."

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        return u.is_superuser or u.has_perm("q_accounts.can_create_survey")


class IsOwnerOrSuperUser(BasePermission):
    owner_field = "created_by"

    def has_object_permission(self, request, view, obj):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if u.is_superuser:
            return True
        return getattr(obj, self.owner_field, None) == u