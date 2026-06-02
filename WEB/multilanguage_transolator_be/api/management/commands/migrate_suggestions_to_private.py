from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from api.models.keyword import KeywordSuggestion, PrivateKeyword


LANG_FIELDS = [
    "japanese",
    "english",
    "vietnamese",
    "chinese_traditional",
    "chinese_simplified",
    "thai",
    "bengali",
    "hindi",
    "indonesian",
    "oriya",
]


def normalize(value):
    return (value or "").strip()


def build_signature_from_obj(obj):
    return tuple(normalize(getattr(obj, f, "")) for f in LANG_FIELDS)


def has_any_value(signature):
    return any(bool(v) for v in signature)


class Command(BaseCommand):
    help = (
        "Chuyển keyword từ KeywordSuggestion sang PrivateKeyword đúng theo từng user.\n"
        "- Chỉ xử lý suggestion có user != null.\n"
        "- Upsert theo (user + toàn bộ cột ngôn ngữ) để tránh tạo trùng trong private.\n"
        "- Mặc định xử lý tất cả status."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--status",
            default="all",
            help="Lọc theo status suggestion (pending/approved/rejected/all). Mặc định: all.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Chỉ thống kê, KHÔNG ghi dữ liệu.",
        )

    def handle(self, *args, **options):
        status = (options.get("status") or "all").strip().lower()
        dry_run = options.get("dry_run", False)

        suggestions = KeywordSuggestion.objects.filter(user__isnull=False).select_related("user")
        if status != "all":
            suggestions = suggestions.filter(status=status)

        suggestions = suggestions.order_by("id")

        if not suggestions.exists():
            self.stdout.write(self.style.WARNING("Không có suggestion nào phù hợp để migrate."))
            return

        private_map = defaultdict(dict)
        for pk in PrivateKeyword.objects.all().only("id", "user_id", *LANG_FIELDS):
            sig = build_signature_from_obj(pk)
            private_map[pk.user_id][sig] = pk.id

        processed = 0
        created = 0
        existed = 0
        skipped_no_value = 0

        def process():
            nonlocal processed, created, existed, skipped_no_value
            for s in suggestions.iterator():
                processed += 1
                sig = build_signature_from_obj(s)

                if not has_any_value(sig):
                    skipped_no_value += 1
                    continue

                uid = s.user_id
                if sig in private_map[uid]:
                    existed += 1
                    continue

                payload = {f: getattr(s, f, None) for f in LANG_FIELDS}
                PrivateKeyword.objects.create(
                    user=s.user,
                    suggestion=s,
                    **payload,
                )
                created += 1
                private_map[uid][sig] = -1

        if dry_run:
            process()
            self.stdout.write(
                self.style.WARNING(
                    f"[DRY-RUN] Processed={processed}, Created={created}, "
                    f"AlreadyExists={existed}, SkippedEmpty={skipped_no_value}, status={status}"
                )
            )
            return

        with transaction.atomic():
            process()

        self.stdout.write(
            self.style.SUCCESS(
                f"Migrate xong. Processed={processed}, Created={created}, "
                f"AlreadyExists={existed}, SkippedEmpty={skipped_no_value}, status={status}"
            )
        )
