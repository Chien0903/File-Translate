from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count

from api.models.keyword import KeywordSuggestion


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


class Command(BaseCommand):
    help = (
        "Dọn dữ liệu trùng trong KeywordSuggestion theo từng user.\n"
        "- Gộp theo (user, bộ giá trị các cột ngôn ngữ, status).\n"
        "- Giữ lại 1 bản ghi, xóa các bản còn lại trong cùng nhóm.\n"
        "- Mặc định chỉ xử lý status=pending để an toàn."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--status",
            default="pending",
            help="Chỉ xử lý các bản ghi với status này (mặc định: pending).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Chỉ in thống kê, KHÔNG xóa dữ liệu.",
        )

    def handle(self, *args, **options):
        status = options["status"]
        dry_run = options["dry_run"]

        qs = (
            KeywordSuggestion.objects.filter(status=status)
            .values("user_id", *LANG_FIELDS)
            .annotate(dup_count=Count("id"))
            .filter(dup_count__gt=1)
        )

        total_groups = qs.count()
        total_extra = sum(row["dup_count"] - 1 for row in qs)

        if total_groups == 0:
            self.stdout.write(self.style.SUCCESS("Không tìm thấy bản ghi trùng."))
            return

        self.stdout.write(
            self.style.WARNING(
                f"Tìm thấy {total_groups} nhóm trùng, tổng {total_extra} bản ghi dư (status={status})."
            )
        )

        # Lấy id cụ thể của từng nhóm để xoá
        groups = defaultdict(list)
        for obj in KeywordSuggestion.objects.filter(status=status).values(
            "id", "user_id", *LANG_FIELDS
        ):
            key = (
                obj["user_id"],
                tuple((obj[f] or "").strip() for f in LANG_FIELDS),
                status,
            )
            groups[key].append(obj["id"])

        to_delete_ids = []
        for key, ids in groups.items():
            if len(ids) <= 1:
                continue
            # Giữ lại id nhỏ nhất (cũ nhất), xoá các id còn lại
            ids_sorted = sorted(ids)
            to_delete_ids.extend(ids_sorted[1:])

        if not to_delete_ids:
            self.stdout.write(
                self.style.SUCCESS("Không có bản ghi nào cần xoá sau khi gom nhóm.")
            )
            return

        self.stdout.write(
            f"Sẽ xoá {len(to_delete_ids)} bản ghi trùng (giữ lại 1 bản trong mỗi nhóm)."
        )

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "Đang ở chế độ --dry-run, KHÔNG xoá dữ liệu. "
                    "Chạy lại không có --dry-run nếu bạn đồng ý dọn trùng."
                )
            )
            return

        with transaction.atomic():
            deleted_count, _ = KeywordSuggestion.objects.filter(
                id__in=to_delete_ids
            ).delete()

        self.stdout.write(
            self.style.SUCCESS(f"Đã xoá {deleted_count} bản ghi trùng trong KeywordSuggestion.")
        )
