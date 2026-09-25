from rest_framework.permissions import SAFE_METHODS, BasePermission


class SurveyPermission(BasePermission):
    message = "You do not have permission to access this survey."

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return u.is_superuser or u.has_perm("q_accounts.can_create_survey")

    def has_object_permission(self, request, view, obj):
        u = request.user
        if u.is_superuser:
            return True

        if request.method in SAFE_METHODS:
            if obj.status == "PUBLISHED" and not obj.is_deleted:
                if obj.created_by_id == u.id:
                    return True
                if obj.visibility == "PUBLIC":
                    return True
                from apps.q_assignments.models import SurveyAssignment
                return SurveyAssignment.objects.filter(survey=obj, user=u).exists()
            return obj.created_by_id == u.id

        return (
            obj.created_by_id == u.id
            and u.has_perm("q_accounts.can_create_survey")
        )


class QuestionPermission(BasePermission):
    message = "You cannot modify this question."

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return u.is_superuser or u.has_perm("q_accounts.can_create_survey")

    def has_object_permission(self, request, view, obj):
        u = request.user
        if u.is_superuser:
            return True

        survey = obj.survey

        if request.method in SAFE_METHODS:
            if survey.created_by_id == u.id:
                return True
            if survey.status == "PUBLISHED" and survey.visibility == "PUBLIC":
                return True
            if survey.status == "PUBLISHED":
                from apps.q_assignments.models import SurveyAssignment
                return SurveyAssignment.objects.filter(
                    survey=survey, user=u,
                ).exists()
            return False

        if survey.created_by_id != u.id:
            return False
        if survey.status == "PUBLISHED":
            from apps.q_responses.models import SurveyResponse
            if SurveyResponse.objects.filter(survey=survey).exists():
                self.message = (
                    "Cannot modify questions of a published survey that has responses."
                )
                return False
        return True