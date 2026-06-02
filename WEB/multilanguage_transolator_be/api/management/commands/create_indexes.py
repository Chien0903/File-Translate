"""
Management command to create database indexes for performance optimization
"""
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Create database indexes for keyword statistics performance'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            self.stdout.write('Creating indexes for KeywordSuggestion...')
            
            # Index on created_at for date range queries
            try:
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_keyword_suggestion_created_at 
                    ON api_keywordsuggestion (created_at DESC);
                """)
                self.stdout.write(self.style.SUCCESS('✓ Created index on created_at'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Index on created_at may already exist: {e}'))
            
            # Index on status for filtering
            try:
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_keyword_suggestion_status 
                    ON api_keywordsuggestion (status);
                """)
                self.stdout.write(self.style.SUCCESS('✓ Created index on status'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Index on status may already exist: {e}'))
            
            # Composite index on user_id and created_at for user statistics
            try:
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_keyword_suggestion_user_created 
                    ON api_keywordsuggestion (user_id, created_at DESC);
                """)
                self.stdout.write(self.style.SUCCESS('✓ Created composite index on user_id and created_at'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Composite index may already exist: {e}'))
            
            # Composite index for date range and status queries
            try:
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_keyword_suggestion_created_status 
                    ON api_keywordsuggestion (created_at DESC, status);
                """)
                self.stdout.write(self.style.SUCCESS('✓ Created composite index on created_at and status'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Composite index may already exist: {e}'))
            
            self.stdout.write(self.style.SUCCESS('\n✓ All indexes created successfully!'))
            self.stdout.write(self.style.SUCCESS('Run ANALYZE on your database to update statistics.'))

