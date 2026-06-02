import os
import sys
import pandas as pd
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.db.models import Count
from api.models.keyword import KeywordQueue, KeywordSuggestion
from collections import defaultdict
import tempfile
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Process keyword queue and generate suggestions based on frequency analysis'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--min-frequency',
            type=float,
            default=2.0,
            help='Minimum frequency percentage for a keyword to be suggested (default: 2.0)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be processed without actually processing'
        )
        
    def handle(self, *args, **options):
        min_frequency = options['min_frequency']
        dry_run = options['dry_run']
        
        self.stdout.write(
            self.style.SUCCESS(f'Starting keyword queue processing...')
        )
        
        # Lấy tất cả items chưa được xử lý từ queue
        unprocessed_queue = KeywordQueue.objects.filter(is_processed=False)
        total_unprocessed = unprocessed_queue.count()  # 1 query duy nhất

        if total_unprocessed == 0:
            self.stdout.write(
                self.style.WARNING('No unprocessed items in keyword queue')
            )
            return

        self.stdout.write(f'Found {total_unprocessed} unprocessed items in queue')
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING('DRY RUN MODE - No changes will be made')
            )
            for item in unprocessed_queue:
                self.stdout.write(f'  - {item}')
            return
            
        # Tạo temporary Excel file từ queue data
        temp_file = self.create_temp_excel_from_queue(unprocessed_queue)
        
        try:
            # Chạy statistic analysis
            suggested_keywords = self.run_statistic_analysis(temp_file, min_frequency)
            
            # Tạo hoặc cập nhật KeywordSuggestion records
            self.create_suggestions_from_analysis(suggested_keywords)
            
            # Đánh dấu queue items đã được xử lý
            unprocessed_queue.update(
                is_processed=True,
                processed_at=timezone.now()
            )
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully processed {total_unprocessed} queue items'
                )
            )
            
        except Exception as e:
            raise CommandError(f'Error processing queue: {str(e)}')
        finally:
            # Cleanup temp file
            if os.path.exists(temp_file):
                os.unlink(temp_file)
                
    def create_temp_excel_from_queue(self, queue_items):
        """Tạo file Excel tạm thời từ queue data (10 cột ngôn ngữ)."""
        data = []
        for item in queue_items:
            data.append({
                'English': item.english or '',
                'Japanese': item.japanese or '',
                'Vietnamese': item.vietnamese or '',
                'Chinese (Traditional)': item.chinese_traditional or '',
                'Chinese (Simplified)': item.chinese_simplified or '',
                'Thai': item.thai or '',
                'Bengali': item.bengali or '',
                'Hindi': item.hindi or '',
                'Indonesian': item.indonesian or '',
                'Oriya': item.oriya or '',
            })

        df = pd.DataFrame(data)
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
        df.to_excel(temp_file.name, index=False)
        temp_file.close()

        self.stdout.write(f'Created temporary Excel file: {temp_file.name}')
        return temp_file.name
        
    def run_statistic_analysis(self, excel_file, min_frequency):
        """Chạy phân tích thống kê trên 10 cột ngôn ngữ, trả về danh sách keyword_data."""
        from itertools import combinations

        languages = [
            "English",
            "Japanese",
            "Vietnamese",
            "Chinese (Traditional)",
            "Chinese (Simplified)",
            "Thai",
            "Bengali",
            "Hindi",
            "Indonesian",
            "Oriya",
        ]

        df = pd.read_excel(excel_file)
        total_rows = len(df)

        self.stdout.write(f'Analyzing {total_rows} records...')

        suggested_keywords = {}

        for lang1, lang2 in combinations(languages, 2):
            if lang1 not in df.columns or lang2 not in df.columns:
                continue

            pair_df = df[[lang1, lang2]].copy()

            pair_counts = (
                pair_df
                .value_counts()
                .reset_index(name="Count")
            )
            if total_rows > 0:
                pair_counts["Percentage"] = (pair_counts["Count"] / total_rows * 100).round(2)
            else:
                pair_counts["Percentage"] = 0.0

            filtered = pair_counts[pair_counts["Percentage"] >= float(min_frequency)]

            self.stdout.write(
                f'  {lang1}-{lang2}: {len(filtered)} suggestions above {min_frequency}%'
            )

            for row in filtered.to_dict('records'):
                # Key theo cặp để gộp chính xác
                key = (lang1, row[lang1], lang2, row[lang2])
                if key not in suggested_keywords:
                    keyword_data = {
                        "English": "",
                        "Japanese": "",
                        "Vietnamese": "",
                        "Chinese (Traditional)": "",
                        "Chinese (Simplified)": "",
                        "Count": 0,
                        "Percentage": 0.0,
                    }
                    keyword_data[lang1] = row[lang1]
                    keyword_data[lang2] = row[lang2]
                    keyword_data["Count"] = row["Count"]
                    keyword_data["Percentage"] = row["Percentage"]
                    suggested_keywords[key] = keyword_data
                else:
                    if row["Count"] > suggested_keywords[key]["Count"]:
                        suggested_keywords[key]["Count"] = row["Count"]
                        suggested_keywords[key]["Percentage"] = row["Percentage"]

        return list(suggested_keywords.values())
        
    def create_suggestions_from_analysis(self, suggested_keywords):
        """Tạo hoặc cập nhật KeywordSuggestion từ kết quả phân tích (10 cột).

        Uses bulk_create / bulk_update to replace the previous N×2 query loop.
        Algorithm:
          1. Load all existing suggestions in 1 query.
          2. Build a frozenset lookup keyed by non-empty (db_field, value) pairs.
          3. Split keyword_data into to_create / to_update entirely in Python.
          4. bulk_create (1 query) + bulk_update (1 query per 500 rows).
        """
        # Map display names → model field names
        _FIELD_MAP = [
            ("English",               "english"),
            ("Japanese",              "japanese"),
            ("Vietnamese",            "vietnamese"),
            ("Chinese (Traditional)", "chinese_traditional"),
            ("Chinese (Simplified)",  "chinese_simplified"),
            ("Thai",                  "thai"),
            ("Bengali",               "bengali"),
            ("Hindi",                 "hindi"),
            ("Indonesian",            "indonesian"),
            ("Oriya",                 "oriya"),
        ]

        def _lookup_key(db_values: dict) -> frozenset:
            return frozenset(
                (db_field, db_values[db_field])
                for _, db_field in _FIELD_MAP
                if db_values.get(db_field)
            )

        # 1 query: load all existing suggestions
        existing_by_key: dict = {}
        for suggestion in KeywordSuggestion.objects.all():
            db_vals = {db_field: getattr(suggestion, db_field, "") or "" for _, db_field in _FIELD_MAP}
            key = _lookup_key(db_vals)
            if key:
                existing_by_key[key] = suggestion

        to_create: list = []
        to_update: list = []

        for keyword_data in suggested_keywords:
            db_vals = {
                db_field: keyword_data.get(display, "") or ""
                for display, db_field in _FIELD_MAP
            }
            count = keyword_data.get("Count", 1)
            percentage = keyword_data.get("Percentage", 0.0)
            key = _lookup_key(db_vals)

            if key in existing_by_key:
                suggestion = existing_by_key[key]
                suggestion.suggestion_count += count
                suggestion.frequency_percentage = max(suggestion.frequency_percentage, percentage)
                to_update.append(suggestion)
            else:
                new_obj = KeywordSuggestion(
                    suggestion_count=count,
                    frequency_percentage=percentage,
                    status='pending',
                    **db_vals,
                )
                to_create.append(new_obj)
                # Register in lookup so duplicates within this batch don't create twice
                existing_by_key[key] = new_obj

        if to_create:
            KeywordSuggestion.objects.bulk_create(to_create, batch_size=500, ignore_conflicts=True)

        if to_update:
            KeywordSuggestion.objects.bulk_update(
                to_update,
                ['suggestion_count', 'frequency_percentage'],
                batch_size=500,
            )

        self.stdout.write(
            self.style.SUCCESS(
                f'Created {len(to_create)} new suggestions, updated {len(to_update)} existing ones'
            )
        )
