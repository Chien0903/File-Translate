"""
Management command: seed_library_data

Creates sample KeywordSuggestion (common library) and PrivateKeyword (private library)
records for development / demo purposes.

Usage:
    python manage.py seed_library_data
    python manage.py seed_library_data --user admin@example.com
    python manage.py seed_library_data --clear
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model

from api.models.keyword import KeywordSuggestion, PrivateKeyword

User = get_user_model()

# ---------------------------------------------------------------------------
# Seed data – Common Library (KeywordSuggestion, status='approved')
# ---------------------------------------------------------------------------
COMMON_KEYWORDS = [
    {
        "en": "Carbon fiber",
        "ja": "炭素繊維",
        "vi": "Sợi carbon",
        "zh-TW": "碳纖維",
        "zh-CN": "碳纤维",
        "th": "เส้นใยคาร์บอน",
        "bn": "কার্বন ফাইবার",
        "hi": "कार्बन फाइबर",
        "id": "Serat karbon",
        "or": "କାର୍ବନ ଫାଇବର",
        "fr": "Fibre de carbone",
    },
    {
        "en": "Polyester resin",
        "ja": "ポリエステル樹脂",
        "vi": "Nhựa polyester",
        "zh-TW": "聚酯樹脂",
        "zh-CN": "聚酯树脂",
        "th": "เรซินโพลีเอสเตอร์",
        "bn": "পলিয়েস্টার রেজিন",
        "hi": "पॉलिएस्टर राल",
        "id": "Resin poliester",
        "or": "ପଲିଏଷ୍ଟର ରଜନ",
        "fr": "Résine polyester",
    },
    {
        "en": "Nylon fiber",
        "ja": "ナイロン繊維",
        "vi": "Sợi nylon",
        "zh-TW": "尼龍纖維",
        "zh-CN": "尼龙纤维",
        "th": "เส้นใยไนลอน",
        "bn": "নাইলন ফাইবার",
        "hi": "नायलॉन फाइबर",
        "id": "Serat nilon",
        "or": "ନାଇଲନ ଫାଇବର",
        "fr": "Fibre de nylon",
    },
    {
        "en": "Tensile strength",
        "ja": "引張強度",
        "vi": "Độ bền kéo",
        "zh-TW": "抗拉強度",
        "zh-CN": "抗拉强度",
        "th": "ความต้านทานแรงดึง",
        "bn": "টেনসাইল শক্তি",
        "hi": "तन्य शक्ति",
        "id": "Kekuatan tarik",
        "or": "ଟେନ୍ସାଇଲ ଶ୍ରେଷ୍ଠ",
        "fr": "Résistance à la traction",
    },
    {
        "en": "Composite material",
        "ja": "複合材料",
        "vi": "Vật liệu composite",
        "zh-TW": "複合材料",
        "zh-CN": "复合材料",
        "th": "วัสดุคอมโพสิต",
        "bn": "যৌগিক উপকরণ",
        "hi": "मिश्रित सामग्री",
        "id": "Material komposit",
        "or": "କମ୍ପୋଜିଟ ସାମଗ୍ରୀ",
        "fr": "Matériau composite",
    },
    {
        "en": "Waterproof coating",
        "ja": "防水コーティング",
        "vi": "Lớp phủ chống thấm nước",
        "zh-TW": "防水塗層",
        "zh-CN": "防水涂层",
        "th": "การเคลือบกันน้ำ",
        "bn": "জলরোধী আবরণ",
        "hi": "वाटरप्रूफ कोटिंग",
        "id": "Lapisan anti air",
        "or": "ୱାଟରପ୍ରୁଫ୍ କୋଟିଂ",
        "fr": "Revêtement imperméable",
    },
    {
        "en": "Quality inspection",
        "ja": "品質検査",
        "vi": "Kiểm tra chất lượng",
        "zh-TW": "品質檢驗",
        "zh-CN": "质量检验",
        "th": "การตรวจสอบคุณภาพ",
        "bn": "গুণমান পরীক্ষা",
        "hi": "गुणवत्ता निरीक्षण",
        "id": "Inspeksi kualitas",
        "or": "ଗୁଣବତ୍ତା ଯାଞ୍ଚ",
        "fr": "Inspection de la qualité",
    },
    {
        "en": "Manufacturing process",
        "ja": "製造プロセス",
        "vi": "Quy trình sản xuất",
        "zh-TW": "製造過程",
        "zh-CN": "制造过程",
        "th": "กระบวนการผลิต",
        "bn": "উৎপাদন প্রক্রিয়া",
        "hi": "विनिर्माण प्रक्रिया",
        "id": "Proses manufaktur",
        "or": "ଉତ୍ପାଦନ ପ୍ରକ୍ରିୟା",
        "fr": "Processus de fabrication",
    },
    {
        "en": "Raw material",
        "ja": "原材料",
        "vi": "Nguyên liệu thô",
        "zh-TW": "原材料",
        "zh-CN": "原材料",
        "th": "วัตถุดิบ",
        "bn": "কাঁচামাল",
        "hi": "कच्चा माल",
        "id": "Bahan baku",
        "or": "କଞ୍ଚା ସାମଗ୍ରୀ",
        "fr": "Matière première",
    },
    {
        "en": "Thermal resistance",
        "ja": "耐熱性",
        "vi": "Khả năng chịu nhiệt",
        "zh-TW": "耐熱性",
        "zh-CN": "耐热性",
        "th": "ความทนทานต่อความร้อน",
        "bn": "তাপ প্রতিরোধ",
        "hi": "तापीय प्रतिरोध",
        "id": "Ketahanan termal",
        "or": "ତାପ ପ୍ରତିରୋଧ",
        "fr": "Résistance thermique",
    },
    {
        "en": "Fiber reinforcement",
        "ja": "繊維強化",
        "vi": "Gia cường sợi",
        "zh-TW": "纖維增強",
        "zh-CN": "纤维增强",
        "th": "การเสริมแรงด้วยเส้นใย",
        "bn": "ফাইবার শক্তিশালীকরণ",
        "hi": "फाइबर प्रबलित",
        "id": "Penguatan serat",
        "or": "ଫାଇବର ରିଇନଫୋର୍ସମେଂଟ",
        "fr": "Renforcement par fibre",
    },
    {
        "en": "Production line",
        "ja": "生産ライン",
        "vi": "Dây chuyền sản xuất",
        "zh-TW": "生產線",
        "zh-CN": "生产线",
        "th": "สายการผลิต",
        "bn": "উৎপাদন লাইন",
        "hi": "उत्पादन लाइन",
        "id": "Lini produksi",
        "or": "ଉତ୍ପାଦନ ଲାଇନ",
        "fr": "Ligne de production",
    },
    {
        "en": "Safety standard",
        "ja": "安全基準",
        "vi": "Tiêu chuẩn an toàn",
        "zh-TW": "安全標準",
        "zh-CN": "安全标准",
        "th": "มาตรฐานความปลอดภัย",
        "bn": "নিরাপত্তা মান",
        "hi": "सुरक्षा मानक",
        "id": "Standar keselamatan",
        "or": "ସୁରକ୍ଷା ମାନ",
        "fr": "Norme de sécurité",
    },
    {
        "en": "Delivery date",
        "ja": "納期",
        "vi": "Ngày giao hàng",
        "zh-TW": "交貨日期",
        "zh-CN": "交货日期",
        "th": "วันส่งมอบ",
        "bn": "ডেলিভারি তারিখ",
        "hi": "डिलीवरी तिथि",
        "id": "Tanggal pengiriman",
        "or": "ଡେଲିଭରି ତାରିଖ",
        "fr": "Date de livraison",
    },
    {
        "en": "Weaving machine",
        "ja": "織機",
        "vi": "Máy dệt",
        "zh-TW": "織機",
        "zh-CN": "织机",
        "th": "เครื่องทอผ้า",
        "bn": "বুননযন্ত্র",
        "hi": "बुनाई मशीन",
        "id": "Mesin tenun",
        "or": "ବୁଣାଯନ୍ତ୍ର",
        "fr": "Machine à tisser",
    },
]

# ---------------------------------------------------------------------------
# Seed data – Private Library (PrivateKeyword)
# ---------------------------------------------------------------------------
PRIVATE_KEYWORDS = [
    {
        "en": "Film lamination",
        "ja": "フィルムラミネーション",
        "vi": "Ép màng phim",
        "zh-TW": "薄膜層壓",
        "zh-CN": "薄膜层压",
        "th": "การลามิเนตฟิล์ม",
        "bn": "ফিল্ম ল্যামিনেশন",
        "hi": "फिल्म लैमिनेशन",
        "id": "Laminasi film",
        "or": "ଫିଲ୍ମ ଲ୍ୟାମିନେସନ",
    },
    {
        "en": "Polyimide film",
        "ja": "ポリイミドフィルム",
        "vi": "Màng polyimide",
        "zh-TW": "聚醯亞胺薄膜",
        "zh-CN": "聚酰亚胺薄膜",
        "th": "ฟิล์มโพลิอิไมด์",
        "bn": "পলিমাইড ফিল্ম",
        "hi": "पॉलिमाइड फिल्म",
        "id": "Film poliimida",
        "or": "ପଲିଇମାଇଡ ଫିଲ୍ମ",
    },
    {
        "en": "Warp yarn",
        "ja": "経糸",
        "vi": "Sợi dọc",
        "zh-TW": "經紗",
        "zh-CN": "经纱",
        "th": "ด้ายยืน",
        "bn": "ওয়ার্প ইয়ার্ন",
        "hi": "ताना धागा",
        "id": "Benang lungsin",
        "or": "ୱାର୍ପ ସୂତା",
    },
    {
        "en": "Weft yarn",
        "ja": "緯糸",
        "vi": "Sợi ngang",
        "zh-TW": "緯紗",
        "zh-CN": "纬纱",
        "th": "ด้ายพุ่ง",
        "bn": "ওয়েফট ইয়ার্ন",
        "hi": "बाना धागा",
        "id": "Benang pakan",
        "or": "ୱେଫ୍ଟ ସୂତା",
    },
    {
        "en": "Defect rate",
        "ja": "不良率",
        "vi": "Tỷ lệ lỗi",
        "zh-TW": "缺陷率",
        "zh-CN": "缺陷率",
        "th": "อัตราของเสีย",
        "bn": "ত্রুটির হার",
        "hi": "दोष दर",
        "id": "Tingkat cacat",
        "or": "ତ୍ରୁଟି ହାର",
    },
    {
        "en": "Epoxy adhesive",
        "ja": "エポキシ接着剤",
        "vi": "Keo epoxy",
        "zh-TW": "環氧黏合劑",
        "zh-CN": "环氧粘合剂",
        "th": "กาวอีพอกซี",
        "bn": "ইপোক্সি আঠা",
        "hi": "एपॉक्सी चिपकने वाला",
        "id": "Perekat epoksi",
        "or": "ଏପୋକ୍ସି ଆଢ଼ୁଆ",
    },
    {
        "en": "Moisture absorption",
        "ja": "吸湿性",
        "vi": "Hút ẩm",
        "zh-TW": "吸濕性",
        "zh-CN": "吸湿性",
        "th": "การดูดซับความชื้น",
        "bn": "আর্দ্রতা শোষণ",
        "hi": "नमी अवशोषण",
        "id": "Penyerapan kelembapan",
        "or": "ଆର୍ଦ୍ରତା ଅବଶୋଷଣ",
    },
    {
        "en": "Batch number",
        "ja": "バッチ番号",
        "vi": "Số lô",
        "zh-TW": "批次號碼",
        "zh-CN": "批次编号",
        "th": "หมายเลขแบตช์",
        "bn": "ব্যাচ নম্বর",
        "hi": "बैच संख्या",
        "id": "Nomor batch",
        "or": "ବ୍ୟାଚ ନଂ",
    },
    {
        "en": "Yarn count",
        "ja": "糸番手",
        "vi": "Chi số sợi",
        "zh-TW": "紗支數",
        "zh-CN": "纱支数",
        "th": "จำนวนด้าย",
        "bn": "সুতার কাউন্ট",
        "hi": "यार्न काउंट",
        "id": "Hitungan benang",
        "or": "ସୂତା ଗଣନା",
    },
    {
        "en": "Shrinkage rate",
        "ja": "収縮率",
        "vi": "Tỷ lệ co rút",
        "zh-TW": "收縮率",
        "zh-CN": "收缩率",
        "th": "อัตราการหดตัว",
        "bn": "সংকোচনের হার",
        "hi": "संकुचन दर",
        "id": "Tingkat penyusutan",
        "or": "ସଂକୋଚ ହାର",
    },
]


class Command(BaseCommand):
    help = "Seed common library (KeywordSuggestion) and private library (PrivateKeyword) with sample data"

    def add_arguments(self, parser):
        parser.add_argument(
            "--user",
            type=str,
            default=None,
            help="Email of the user to own private keywords (defaults to first superuser)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete all existing KeywordSuggestion and PrivateKeyword records before seeding",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            ks_count = KeywordSuggestion.objects.count()
            pk_count = PrivateKeyword.objects.count()
            KeywordSuggestion.objects.all().delete()
            PrivateKeyword.objects.all().delete()
            self.stdout.write(self.style.WARNING(
                f"Cleared {ks_count} KeywordSuggestion and {pk_count} PrivateKeyword records."
            ))

        # ---- Resolve user for private keywords ----
        email = options["user"]
        if email:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                raise CommandError(f"User with email '{email}' not found.")
        else:
            user = User.objects.filter(is_superuser=True).order_by("id").first()
            if not user:
                user = User.objects.order_by("id").first()
            if not user:
                raise CommandError("No users found in the database. Create a user first.")

        self.stdout.write(f"Private keywords will be assigned to: {user.email}")

        # ---- Common Library ----
        created_common = 0
        skipped_common = 0
        for kw in COMMON_KEYWORDS:
            _, created = KeywordSuggestion.objects.get_or_create(
                translations=kw,
                defaults={
                    "user": user,
                    "suggestion_count": 10,
                    "frequency_percentage": 5.0,
                    "status": "approved",
                    "approved_by": user,
                },
            )
            if created:
                created_common += 1
            else:
                skipped_common += 1

        self.stdout.write(self.style.SUCCESS(
            f"Common library: {created_common} created, {skipped_common} already exist."
        ))

        # ---- Private Library ----
        created_private = 0
        skipped_private = 0
        for kw in PRIVATE_KEYWORDS:
            _, created = PrivateKeyword.objects.get_or_create(
                user=user,
                translations=kw,
            )
            if created:
                created_private += 1
            else:
                skipped_private += 1

        self.stdout.write(self.style.SUCCESS(
            f"Private library: {created_private} created, {skipped_private} already exist."
        ))

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Total seeded: {created_common} common + {created_private} private keywords."
        ))
