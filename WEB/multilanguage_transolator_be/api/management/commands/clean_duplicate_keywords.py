from django.core.management.base import BaseCommand
from django.db import transaction
from api.models.keyword import KeywordSuggestion
from collections import defaultdict

class Command(BaseCommand):
    help = 'Clean duplicate keyword suggestions before adding unique constraint'
    
    def handle(self, *args, **options):
        self.stdout.write('Starting duplicate cleanup...')
        
        # Tìm và xử lý các bản ghi trùng lặp
        duplicates = defaultdict(list)
        
        # Group by unique fields
        for suggestion in KeywordSuggestion.objects.all():
            key = (
                suggestion.japanese or '',
                suggestion.english or '',
                suggestion.vietnamese or '',
                suggestion.chinese_traditional or '',
                suggestion.chinese_simplified or ''
            )
            duplicates[key].append(suggestion)
        
        cleaned_count = 0
        
        for key, suggestions in duplicates.items():
            if len(suggestions) > 1:
                # Sắp xếp theo id để giữ lại cái cũ nhất
                suggestions.sort(key=lambda x: x.id)
                keep = suggestions[0]
                to_delete = suggestions[1:]
                
                self.stdout.write(
                    f'Found {len(suggestions)} duplicates for key: {key}'
                )
                self.stdout.write(f'  Keeping: ID {keep.id}')
                
                # Xóa các bản ghi trùng lặp
                for suggestion in to_delete:
                    self.stdout.write(f'  Deleting: ID {suggestion.id}')
                    suggestion.delete()
                    cleaned_count += 1
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully cleaned {cleaned_count} duplicate keyword suggestions'
            )
        )
