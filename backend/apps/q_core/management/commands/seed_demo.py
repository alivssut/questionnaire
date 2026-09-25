"""
Populate the database with realistic Persian demo data.

Usage:
    python manage.py seed_demo              # idempotent: skip if already seeded
    python manage.py seed_demo --flush      # wipe demo data first, then re-seed

Demo accounts (password for ALL: `Demo!2345`):
    admin@formly.local       — superuser
    creator1@formly.local    — can_create_survey
    creator2@formly.local    — can_create_survey
    user1..user8@formly.local — regular users
"""
from datetime import timedelta

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.q_accounts.models import User
from apps.q_activity.models import ActivityLog
from apps.q_activity.utils import log_activity
from apps.q_assignments.models import SurveyAssignment
from apps.q_notifications.models import Notification
from apps.q_responses.models import Answer, AnswerFile, SurveyResponse
from apps.q_surveys.models import (
    ListItem,
    MatrixColumn,
    MatrixRow,
    Question,
    QuestionOption,
    Survey,
    SystemList,
)

DEMO_DOMAIN = "@formly.local"
DEMO_PASSWORD = "Demo!2345"


class Command(BaseCommand):
    help = "Seed the database with Persian demo data."

    def add_arguments(self, parser):
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Delete existing demo data before seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["flush"]:
            self._flush()
        elif User.objects.filter(email=f"admin{DEMO_DOMAIN}").exists():
            self.stdout.write(self.style.WARNING(
                "Demo data already exists. Use --flush to reset."
            ))
            return

        self.stdout.write("در حال ساخت داده‌ی نمونه ...")

        users = self._create_users()
        self._create_system_lists()
        surveys = self._create_surveys(users)
        self._create_assignments(users, surveys)
        self._create_responses(users, surveys)
        self._create_notifications(users)
        self._create_activity_logs(users, surveys)

        self.stdout.write(self.style.SUCCESS("\n=== داده‌ی نمونه آماده است ==="))
        self.stdout.write(f"ورود ادمین:    admin{DEMO_DOMAIN} / {DEMO_PASSWORD}")
        self.stdout.write(f"ورود سازنده:   creator1{DEMO_DOMAIN} / {DEMO_PASSWORD}")
        self.stdout.write(f"ورود کاربر:    user1{DEMO_DOMAIN} / {DEMO_PASSWORD}")
        self.stdout.write("پنل ادمین:     http://localhost:8000/admin/")
        self.stdout.write("مستندات API:   http://localhost:8000/api/docs/")

    # ------------------------------------------------------------------
    # Flush
    # ------------------------------------------------------------------
    def _flush(self):
        self.stdout.write(self.style.WARNING("در حال پاک کردن داده‌های دمو ..."))
        emails = list(
            User.objects.filter(email__endswith=DEMO_DOMAIN)
            .values_list("email", flat=True)
        )
        Survey.all_objects.filter(created_by__email__in=emails).delete()
        User.objects.filter(email__endswith=DEMO_DOMAIN).delete()
        SystemList.objects.filter(slug__startswith="demo-").delete()

    # ------------------------------------------------------------------
    # Users
    # ------------------------------------------------------------------
    def _create_users(self):
        admin = User.objects.create_superuser(
            email=f"admin{DEMO_DOMAIN}",
            password=DEMO_PASSWORD,
            first_name="مدیر",
            last_name="سیستم",
        )

        from django.contrib.auth.models import Permission
        perm = Permission.objects.get(
            content_type__app_label="q_accounts",
            codename="can_create_survey",
        )

        creators = []
        creator_names = [("سارا", "احمدی"), ("رضا", "محمدی")]
        for i, (fn, ln) in enumerate(creator_names, start=1):
            c = User.objects.create_user(
                email=f"creator{i}{DEMO_DOMAIN}",
                password=DEMO_PASSWORD,
                first_name=fn,
                last_name=ln,
                is_verified=True,
            )
            c.user_permissions.add(perm)
            creators.append(c)

        users = []
        user_names = [
            ("علی", "رضایی"),
            ("مینا", "حسینی"),
            ("امید", "کریمی"),
            ("نگار", "موسوی"),
            ("کاوه", "صادقی"),
            ("یاسمن", "جعفری"),
            ("آرش", "نوری"),
            ("پریسا", "شریفی"),
        ]
        for i, (fn, ln) in enumerate(user_names, start=1):
            u = User.objects.create_user(
                email=f"user{i}{DEMO_DOMAIN}",
                password=DEMO_PASSWORD,
                first_name=fn,
                last_name=ln,
                is_verified=True,
            )
            users.append(u)

        self.stdout.write(f"  کاربران: ۱ مدیر + {len(creators)} سازنده + {len(users)} کاربر عادی")
        return {"admin": admin, "creators": creators, "users": users}

    # ------------------------------------------------------------------
    # SystemLists
    # ------------------------------------------------------------------
    def _create_system_lists(self):
        countries = SystemList.objects.create(
            name="کشورها", slug="demo-countries",
            type=SystemList.Type.COUNTRY, is_system=True,
        )
        for i, (label, value) in enumerate([
            ("ایران", "IR"), ("آمریکا", "US"), ("آلمان", "DE"),
            ("فرانسه", "FR"), ("ژاپن", "JP"), ("کانادا", "CA"),
        ]):
            ListItem.objects.create(system_list=countries, label=label, value=value, order=i)

        languages = SystemList.objects.create(
            name="زبان‌ها", slug="demo-languages",
            type=SystemList.Type.LANGUAGE, is_system=True,
        )
        for i, (label, value) in enumerate([
            ("فارسی", "fa"), ("انگلیسی", "en"), ("آلمانی", "de"),
            ("فرانسوی", "fr"), ("ژاپنی", "ja"),
        ]):
            ListItem.objects.create(system_list=languages, label=label, value=value, order=i)

        ages = SystemList.objects.create(
            name="گروه‌های سنی", slug="demo-age-ranges",
            type=SystemList.Type.AGE_RANGE, is_system=True,
        )
        for i, (label, value) in enumerate([
            ("زیر ۱۸ سال", "u18"), ("۱۸ تا ۲۴ سال", "18_24"),
            ("۲۵ تا ۳۴ سال", "25_34"), ("۳۵ تا ۴۴ سال", "35_44"),
            ("۴۵ سال به بالا", "45_plus"),
        ]):
            ListItem.objects.create(system_list=ages, label=label, value=value, order=i)

        self.stdout.write("  لیست‌ها: کشورها، زبان‌ها، گروه‌های سنی (۳)")

    # ------------------------------------------------------------------
    # Surveys + Questions
    # ------------------------------------------------------------------
    def _create_surveys(self, users):
        admin = users["admin"]
        c1, c2 = users["creators"]

        # ------------------------------------------------------------------
        # سروی ۱ — نمایش همه‌ی انواع سؤال، PUBLISHED / PUBLIC
        # ------------------------------------------------------------------
        s1 = Survey.objects.create(
            created_by=admin,
            title="نمونه: انواع سؤال",
            description="نمایش همه‌ی انواع سؤال پشتیبانی‌شده در سیستم.",
            category="demo",
            status=Survey.Status.PUBLISHED,
            visibility=Survey.Visibility.PUBLIC,
            response_mode=Survey.ResponseMode.IDENTIFIED,
            estimated_time_minutes=8,
            published_at=timezone.now() - timedelta(days=5),
        )
        self._create_showcase_questions(s1)

        # ------------------------------------------------------------------
        # سروی ۲ — نظرسنجی NPS، PUBLISHED / ASSIGNED
        # ------------------------------------------------------------------
        s2 = Survey.objects.create(
            created_by=admin,
            title="نمونه: نظرسنجی رضایت و NPS",
            description="نظرسنجی کوتاه NPS برای کاربران انتخاب‌شده.",
            category="demo",
            status=Survey.Status.PUBLISHED,
            visibility=Survey.Visibility.ASSIGNED,
            response_mode=Survey.ResponseMode.IDENTIFIED,
            estimated_time_minutes=3,
            published_at=timezone.now() - timedelta(days=3),
        )
        Question.objects.create(
            survey=s2, type=Question.Type.NPS,
            title="چقدر احتمال دارد ما را به دیگران توصیه کنید؟",
            required=True, order=1, settings={"min": 0, "max": 10},
        )
        Question.objects.create(
            survey=s2, type=Question.Type.RATING,
            title="محصول ما را چقدر امتیاز می‌دهید؟",
            required=True, order=2, settings={"min": 1, "max": 5},
        )
        Question.objects.create(
            survey=s2, type=Question.Type.LONG_TEXT,
            title="چه پیشنهادی برای بهبود دارید؟",
            required=False, order=3,
        )

        # ------------------------------------------------------------------
        # سروی ۳ — بازخورد مشتری، PUBLISHED / PUBLIC / ANONYMOUS
        # ------------------------------------------------------------------
        s3 = Survey.objects.create(
            created_by=c1,
            title="نمونه: بازخورد مشتری",
            description="نظرسنجی کوتاه و ناشناس.",
            category="feedback",
            status=Survey.Status.PUBLISHED,
            visibility=Survey.Visibility.PUBLIC,
            response_mode=Survey.ResponseMode.ANONYMOUS,
            estimated_time_minutes=2,
            published_at=timezone.now() - timedelta(days=2),
        )
        sc = Question.objects.create(
            survey=s3, type=Question.Type.SINGLE_CHOICE,
            title="تجربه‌ی کلی شما چطور بود؟", required=True, order=1,
        )
        for i, (label, value) in enumerate([
            ("خیلی بد", "1"), ("بد", "2"), ("متوسط", "3"),
            ("خوب", "4"), ("عالی", "5"),
        ]):
            QuestionOption.objects.create(question=sc, label=label, value=value, order=i)
        Question.objects.create(
            survey=s3, type=Question.Type.MULTIPLE_CHOICE,
            title="از چه چیزی راضی بودید؟ (چند گزینه)",
            required=False, order=2,
            settings={"options": [
                {"label": "سرعت", "value": "speed"},
                {"label": "طراحی", "value": "design"},
                {"label": "پشتیبانی", "value": "support"},
                {"label": "قیمت", "value": "pricing"},
            ]},
        )
        Question.objects.create(
            survey=s3, type=Question.Type.EMAIL,
            title="ایمیل تماس (اختیاری)", required=False, order=3,
        )

        # ------------------------------------------------------------------
        # سروی ۴ — پیش‌نویس
        # ------------------------------------------------------------------
        s4 = Survey.objects.create(
            created_by=c1,
            title="نمونه: پیش‌نویس — بازخورد آنبوردینگ",
            description="در حال تکمیل.",
            status=Survey.Status.DRAFT,
            visibility=Survey.Visibility.ASSIGNED,
            estimated_time_minutes=5,
        )
        Question.objects.create(
            survey=s4, type=Question.Type.SHORT_TEXT,
            title="نظر شما چه بود؟", required=True, order=1,
        )

        # ------------------------------------------------------------------
        # سروی ۵ — بسته‌شده
        # ------------------------------------------------------------------
        s5 = Survey.objects.create(
            created_by=c2,
            title="نمونه: بسته‌شده — نظرسنجی بتا تسترها",
            description="این نظرسنجی بسته شده است.",
            status=Survey.Status.CLOSED,
            visibility=Survey.Visibility.ASSIGNED,
            response_mode=Survey.ResponseMode.IDENTIFIED,
            estimated_time_minutes=4,
            published_at=timezone.now() - timedelta(days=30),
        )
        Question.objects.create(
            survey=s5, type=Question.Type.YES_NO,
            title="آیا نسخه‌ی بتا انتظارات شما را برآورده کرد؟",
            required=True, order=1,
        )
        Question.objects.create(
            survey=s5, type=Question.Type.LONG_TEXT,
            title="چرا؟", required=False, order=2,
        )

        self.stdout.write("  سروی‌ها: ۵ (منتشر×۳، پیش‌نویس×۱، بسته×۱)")
        return {"s1": s1, "s2": s2, "s3": s3, "s4": s4, "s5": s5}

    def _create_showcase_questions(self, survey):
        """یک سؤال از هر ۲۲ نوع پشتیبانی‌شده."""
        order = 0

        def nxt():
            nonlocal order
            order += 1
            return order

        # Layout
        Question.objects.create(
            survey=survey, type=Question.Type.SECTION,
            title="بخش ۱: اطلاعات شما", order=nxt(),
        )
        Question.objects.create(
            survey=survey, type=Question.Type.TEXT_BLOCK,
            title="خوش آمدید!",
            description="این فرم کوتاه اطلاعاتی درباره شما جمع‌آوری می‌کند.",
            order=nxt(),
        )

        # Text
        Question.objects.create(
            survey=survey, type=Question.Type.SHORT_TEXT,
            title="نام و نام خانوادگی", required=True, order=nxt(),
        )
        Question.objects.create(
            survey=survey, type=Question.Type.LONG_TEXT,
            title="کمی از خودتان بگویید", order=nxt(),
        )

        # Contact
        Question.objects.create(
            survey=survey, type=Question.Type.EMAIL,
            title="ایمیل", required=True, order=nxt(),
        )
        Question.objects.create(
            survey=survey, type=Question.Type.PHONE,
            title="شماره تماس", order=nxt(),
        )
        Question.objects.create(
            survey=survey, type=Question.Type.URL,
            title="وب‌سایت شما", order=nxt(),
        )

        # Numeric
        Question.objects.create(
            survey=survey, type=Question.Type.NUMBER,
            title="سن", settings={"min": 1, "max": 120}, order=nxt(),
        )
        Question.objects.create(
            survey=survey, type=Question.Type.RATING,
            title="به خدمات ما چه امتیازی می‌دهید؟",
            settings={"min": 1, "max": 5}, order=nxt(),
        )
        Question.objects.create(
            survey=survey, type=Question.Type.LINEAR_SCALE,
            title="چقدر راضی هستید؟",
            settings={"min": 1, "max": 10}, order=nxt(),
        )
        Question.objects.create(
            survey=survey, type=Question.Type.NPS,
            title="NPS: احتمال توصیه",
            settings={"min": 0, "max": 10}, order=nxt(),
        )
        Question.objects.create(
            survey=survey, type=Question.Type.SLIDER,
            title="سطح راحتی خود را انتخاب کنید",
            settings={"min": 0, "max": 100}, order=nxt(),
        )

        # Choice
        sc = Question.objects.create(
            survey=survey, type=Question.Type.SINGLE_CHOICE,
            title="روش تماس ترجیحی", required=True, order=nxt(),
        )
        for i, (label, value) in enumerate([
            ("ایمیل", "email"), ("تلفن", "phone"), ("فرقی نمی‌کند", "none"),
        ]):
            QuestionOption.objects.create(question=sc, label=label, value=value, order=i)

        mc = Question.objects.create(
            survey=survey, type=Question.Type.MULTIPLE_CHOICE,
            title="از کدام ویژگی‌ها استفاده می‌کنید؟", order=nxt(),
        )
        for i, (label, value) in enumerate([
            ("پرسشنامه‌ها", "surveys"), ("گزارش‌ها", "reports"),
            ("یکپارچه‌سازی‌ها", "integrations"), ("موبایل", "mobile"),
        ]):
            QuestionOption.objects.create(question=mc, label=label, value=value, order=i)

        dd = Question.objects.create(
            survey=survey, type=Question.Type.DROPDOWN,
            title="کشور", order=nxt(),
        )
        for i, (label, value) in enumerate([
            ("ایران", "IR"), ("آمریکا", "US"),
            ("آلمان", "DE"), ("سایر", "other"),
        ]):
            QuestionOption.objects.create(question=dd, label=label, value=value, order=i)

        Question.objects.create(
            survey=survey, type=Question.Type.YES_NO,
            title="آیا مشتری قدیمی هستید؟", order=nxt(),
        )

        lk = Question.objects.create(
            survey=survey, type=Question.Type.LIKERT,
            title="استفاده از محصول را آسان می‌دانم", order=nxt(),
        )
        for i, (label, value) in enumerate([
            ("کاملاً مخالفم", "1"), ("مخالفم", "2"), ("بی‌نظر", "3"),
            ("موافقم", "4"), ("کاملاً موافقم", "5"),
        ]):
            QuestionOption.objects.create(question=lk, label=label, value=value, order=i)

        rk = Question.objects.create(
            survey=survey, type=Question.Type.RANKING,
            title="این موارد را به ترتیب اهمیت مرتب کنید", order=nxt(),
        )
        for i, (label, value) in enumerate([
            ("قیمت", "price"), ("کیفیت", "quality"), ("سرعت", "speed"),
        ]):
            QuestionOption.objects.create(question=rk, label=label, value=value, order=i)

        # Date/Time
        Question.objects.create(
            survey=survey, type=Question.Type.DATE,
            title="تاریخ مورد نظر", order=nxt(),
        )
        Question.objects.create(
            survey=survey, type=Question.Type.TIME,
            title="ساعت مورد نظر", order=nxt(),
        )
        Question.objects.create(
            survey=survey, type=Question.Type.DATETIME,
            title="تاریخ و ساعت مورد نظر", order=nxt(),
        )

        # Matrix
        mx = Question.objects.create(
            survey=survey, type=Question.Type.MATRIX,
            title="موارد زیر را ارزیابی کنید", order=nxt(),
        )
        for i, label in enumerate(["طراحی", "سرعت", "پشتیبانی"]):
            MatrixRow.objects.create(question=mx, label=label, order=i)
        for i, (label, value) in enumerate([
            ("ضعیف", "1"), ("قابل قبول", "2"), ("خوب", "3"), ("عالی", "4"),
        ]):
            MatrixColumn.objects.create(question=mx, label=label, value=value, order=i)

        # File
        Question.objects.create(
            survey=survey, type=Question.Type.FILE_UPLOAD,
            title="یک تصویر بارگذاری کنید (اختیاری)", order=nxt(),
        )

    # ------------------------------------------------------------------
    # Assignments
    # ------------------------------------------------------------------
    def _create_assignments(self, users, surveys):
        admin = users["admin"]
        c1 = users["creators"][0]
        regular = users["users"]

        now = timezone.now()
        assignments_s2 = []
        for i, u in enumerate(regular[:5]):
            a = SurveyAssignment.objects.create(
                survey=surveys["s2"], user=u, assigned_by=admin,
                due_date=now + timedelta(days=7 - i),
            )
            assignments_s2.append(a)

        assignments_s5 = []
        for i, u in enumerate(regular[:3]):
            a = SurveyAssignment.objects.create(
                survey=surveys["s5"], user=u, assigned_by=c1,
                status=SurveyAssignment.Status.COMPLETED if i < 2 else SurveyAssignment.Status.OVERDUE,
                due_date=now - timedelta(days=1) if i == 2 else now - timedelta(days=10),
                completed_at=now - timedelta(days=5) if i < 2 else None,
            )
            assignments_s5.append(a)

        a_over = assignments_s2[0]
        a_over.due_date = now - timedelta(days=2)
        a_over.status = SurveyAssignment.Status.OVERDUE
        a_over.save(update_fields=["due_date", "status"])

        self.stdout.write(
            f"  انتساب‌ها: {len(assignments_s2)} روی NPS، {len(assignments_s5)} روی بتا"
        )
        return {"s2": assignments_s2, "s5": assignments_s5}

    # ------------------------------------------------------------------
    # Responses + Answers
    # ------------------------------------------------------------------
    def _create_responses(self, users, surveys):
        regular = users["users"]
        s1 = surveys["s1"]
        s2 = surveys["s2"]
        s3 = surveys["s3"]

        SHORT_ANSWERS = [
            "عالی بود", "خوب", "متوسط", "رضایت‌بخش", "نیاز به بهبود دارد",
        ]
        LONG_ANSWERS = [
            "به‌نظرم محصول بسیار کاربردی است و از استفاده از آن راضی هستم.",
            "امکانات خوبی دارد اما نیاز به بهبود سرعت بارگذاری دارد.",
            "طراحی زیباست ولی برخی از قابلیت‌ها جای کار دارند.",
            "تجربه‌ی خوبی بود، به دوستانم توصیه می‌کنم.",
            "از پشتیبانی سریع و موثر تشکر می‌کنم.",
        ]

        def answer_for(q, seed=0):
            t = q.type
            if t == Question.Type.SHORT_TEXT:
                return {"text": SHORT_ANSWERS[seed % len(SHORT_ANSWERS)]}
            if t == Question.Type.LONG_TEXT:
                return {"text": LONG_ANSWERS[seed % len(LONG_ANSWERS)]}
            if t == Question.Type.EMAIL:
                return {"value": f"user{seed + 1}@example.com"}
            if t == Question.Type.PHONE:
                return {"value": f"0912{1000000 + seed:07d}"}
            if t == Question.Type.URL:
                return {"value": f"https://example{seed}.com"}
            if t == Question.Type.NUMBER:
                return {"value": 25 + seed}
            if t in (Question.Type.RATING, Question.Type.LINEAR_SCALE):
                return {"value": (seed % 5) + 1}
            if t == Question.Type.NPS:
                return {"value": (seed * 2) % 11}
            if t == Question.Type.SLIDER:
                return {"value": (seed * 13) % 101}
            if t in (Question.Type.SINGLE_CHOICE, Question.Type.DROPDOWN, Question.Type.LIKERT):
                opt = q.options.first()
                return {"value": opt.value} if opt else {}
            if t == Question.Type.MULTIPLE_CHOICE:
                vals = list(q.options.values_list("value", flat=True)[:2])
                return {"values": vals}
            if t == Question.Type.YES_NO:
                return {"value": "yes" if seed % 2 == 0 else "no"}
            if t == Question.Type.RANKING:
                vals = list(q.options.values_list("value", flat=True))
                return {"values": vals}
            if t == Question.Type.DATE:
                return {"value": "2025-06-15"}
            if t == Question.Type.TIME:
                return {"value": "14:30"}
            if t == Question.Type.DATETIME:
                return {"value": "2025-06-15T14:30"}
            if t == Question.Type.MATRIX:
                rows = list(q.matrix_rows.values_list("id", flat=True))
                first_col = q.matrix_columns.first()
                if not first_col:
                    return {"value": {}}
                return {"value": {str(r): first_col.value for r in rows}}
            if t == Question.Type.FILE_UPLOAD:
                return {}
            return {}

        # سروی ۱ (عمومی) — ۳ پاسخ از کاربران عادی
        for i, u in enumerate(regular[:3]):
            r = SurveyResponse.objects.create(
                survey=s1, user=u, status=SurveyResponse.Status.SUBMITTED,
                submitted_at=timezone.now() - timedelta(days=4 - i),
                completion_time=timedelta(minutes=6 + i),
            )
            for q in s1.questions.exclude(type__in=Question.NON_ANSWERABLE_TYPES):
                val = answer_for(q, seed=i)
                if val:
                    Answer.objects.create(response=r, question=q, value=val)

        # سروی ۲ (assign شده)
        for i in (0, 1):
            u = regular[i]
            r = SurveyResponse.objects.create(
                survey=s2, user=u, status=SurveyResponse.Status.SUBMITTED,
                submitted_at=timezone.now() - timedelta(days=2 - i),
                completion_time=timedelta(minutes=2 + i),
            )
            for q in s2.questions.all():
                val = answer_for(q, seed=i + 3)
                if val:
                    Answer.objects.create(response=r, question=q, value=val)

        # پاسخ پیش‌نویس
        u = regular[2]
        r = SurveyResponse.objects.create(
            survey=s2, user=u, status=SurveyResponse.Status.DRAFT,
        )
        nps_q = s2.questions.filter(type=Question.Type.NPS).first()
        if nps_q:
            Answer.objects.create(response=r, question=nps_q, value={"value": 8})

        # سروی ۳ (ناشناس)
        for i, u in enumerate(regular[3:7]):
            r = SurveyResponse.objects.create(
                survey=s3, user=u, status=SurveyResponse.Status.SUBMITTED,
                submitted_at=timezone.now() - timedelta(days=1),
                completion_time=timedelta(minutes=2),
            )
            for q in s3.questions.all():
                val = answer_for(q, seed=i + 5)
                if val:
                    Answer.objects.create(response=r, question=q, value=val)

        # سروی ۵ (بسته)
        s5 = surveys["s5"]
        for i in (0, 1):
            u = regular[i]
            r = SurveyResponse.objects.create(
                survey=s5, user=u, status=SurveyResponse.Status.SUBMITTED,
                submitted_at=timezone.now() - timedelta(days=20),
                completion_time=timedelta(minutes=5),
            )
            for q in s5.questions.all():
                val = answer_for(q, seed=i)
                if val:
                    Answer.objects.create(response=r, question=q, value=val)

        # فایل نمونه
        s1_file_q = s1.questions.filter(type=Question.Type.FILE_UPLOAD).first()
        first_resp = SurveyResponse.objects.filter(survey=s1).first()
        if s1_file_q and first_resp:
            ans, _ = Answer.objects.get_or_create(
                response=first_resp, question=s1_file_q, defaults={"value": {}},
            )
            AnswerFile.objects.create(
                answer=ans, survey=s1, uploaded_by=first_resp.user,
                file=ContentFile(b"demo file content", name="نمونه.txt"),
                original_name="نمونه.txt",
                content_type="text/plain", size=17,
            )

        total = SurveyResponse.objects.count()
        self.stdout.write(f"  پاسخ‌ها: {total} (ثبت‌شده + پیش‌نویس، همراه با پاسخ سؤالات)")

    # ------------------------------------------------------------------
    # Notifications
    # ------------------------------------------------------------------
    def _create_notifications(self, users):
        regular = users["users"]
        admin = users["admin"]

        for u in regular[:5]:
            Notification.objects.create(
                user=u, type=Notification.Type.ASSIGNMENT_CREATED,
                title="پرسشنامه‌ی جدید تخصیص یافت",
                message="یک نظرسنجی NPS در انتظار شماست.",
                metadata={"survey_title": "نظرسنجی رضایت و NPS"},
            )
        for u in regular[5:8]:
            Notification.objects.create(
                user=u, type=Notification.Type.SYSTEM,
                title="خوش آمدید به فرم‌لی",
                message="از ثبت‌نام شما سپاسگزاریم!",
                is_read=True,
            )
        Notification.objects.create(
            user=admin, type=Notification.Type.COMPLETED,
            title="پاسخ‌های جدید",
            message="۳ کاربر نظرسنجی NPS شما را تکمیل کردند.",
        )

        self.stdout.write(f"  اعلان‌ها: {Notification.objects.count()}")

    # ------------------------------------------------------------------
    # Activity log
    # ------------------------------------------------------------------
    def _create_activity_logs(self, users, surveys):
        admin = users["admin"]
        c1 = users["creators"][0]

        for s in surveys.values():
            if isinstance(s, Survey):
                log_activity(admin, "survey.viewed", s, f"بررسی «{s.title}»")
        log_activity(c1, "survey.duplicated", surveys["s3"], "کلون کردن نظرسنجی بازخورد")

        self.stdout.write(f"  لاگ فعالیت: {ActivityLog.objects.count()}")