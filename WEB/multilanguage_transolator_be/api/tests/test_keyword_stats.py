"""
Unit tests for Keyword Statistics API
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from api.models.keyword import KeywordSuggestion
from datetime import datetime, timedelta
from django.utils import timezone

User = get_user_model()


class KeywordStatsAPITestCase(TestCase):
    """Test cases for Keyword Statistics API"""

    def setUp(self):
        """Set up test data"""
        # Create admin user
        self.admin_user = User.objects.create_user(
            email='admin@test.com',
            first_name='Admin',
            last_name='User',
            password='testpass123',
            role='Admin'
        )
        
        # Create regular user
        self.regular_user = User.objects.create_user(
            email='user@test.com',
            first_name='Regular',
            last_name='User',
            password='testpass123',
            role='User'
        )
        
        # Create another user for testing
        self.user2 = User.objects.create_user(
            email='user2@test.com',
            first_name='User',
            last_name='Two',
            password='testpass123',
            role='User'
        )
        
        # Create test suggestions
        self.create_test_suggestions()
        
        # Set up API client
        self.client = APIClient()
        
    def create_test_suggestions(self):
        """Create test keyword suggestions"""
        base_date = timezone.now() - timedelta(days=7)
        
        # User 1 suggestions
        for i in range(10):
            KeywordSuggestion.objects.create(
                user=self.regular_user,
                japanese=f'テスト{i}',
                english=f'test{i}',
                status='approved' if i < 7 else 'pending',
                created_at=base_date + timedelta(days=i % 7)
            )
        
        # User 2 suggestions
        for i in range(5):
            KeywordSuggestion.objects.create(
                user=self.user2,
                japanese=f'テスト{i+10}',
                english=f'test{i+10}',
                status='approved' if i < 3 else 'rejected',
                created_at=base_date + timedelta(days=i % 5)
            )
    
    def test_admin_can_access_stats(self):
        """Test that admin user can access keyword statistics"""
        self.client.force_authenticate(user=self.admin_user)
        
        start_date = (timezone.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        end_date = timezone.now().strftime('%Y-%m-%d')
        
        url = reverse('keyword-stats')
        response = self.client.get(url, {
            'start': start_date,
            'end': end_date
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('summary', response.data)
        self.assertIn('userStats', response.data)
        self.assertIn('dailyStats', response.data)
    
    def test_regular_user_cannot_access_stats(self):
        """Test that regular user cannot access keyword statistics"""
        self.client.force_authenticate(user=self.regular_user)
        
        start_date = (timezone.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        end_date = timezone.now().strftime('%Y-%m-%d')
        
        url = reverse('keyword-stats')
        response = self.client.get(url, {
            'start': start_date,
            'end': end_date
        })
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_unauthenticated_cannot_access_stats(self):
        """Test that unauthenticated user cannot access keyword statistics"""
        start_date = (timezone.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        end_date = timezone.now().strftime('%Y-%m-%d')
        
        url = reverse('keyword-stats')
        response = self.client.get(url, {
            'start': start_date,
            'end': end_date
        })
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_stats_summary_correctness(self):
        """Test that summary statistics are calculated correctly"""
        self.client.force_authenticate(user=self.admin_user)
        
        start_date = (timezone.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        end_date = timezone.now().strftime('%Y-%m-%d')
        
        url = reverse('keyword-stats')
        response = self.client.get(url, {
            'start': start_date,
            'end': end_date
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        summary = response.data['summary']
        self.assertEqual(summary['totalSuggestions'], 15)  # 10 + 5
        self.assertEqual(summary['totalApproved'], 10)  # 7 + 3
        self.assertEqual(summary['totalRejected'], 2)  # 0 + 2
        self.assertEqual(summary['totalUsers'], 2)
    
    def test_missing_date_parameters(self):
        """Test that missing date parameters return error"""
        self.client.force_authenticate(user=self.admin_user)
        
        url = reverse('keyword-stats')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_invalid_date_format(self):
        """Test that invalid date format returns error"""
        self.client.force_authenticate(user=self.admin_user)
        
        url = reverse('keyword-stats')
        response = self.client.get(url, {
            'start': 'invalid-date',
            'end': '2024-01-01'
        })
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_start_date_after_end_date(self):
        """Test that start date after end date returns error"""
        self.client.force_authenticate(user=self.admin_user)
        
        url = reverse('keyword-stats')
        response = self.client.get(url, {
            'start': '2024-12-31',
            'end': '2024-01-01'
        })
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_user_stats_structure(self):
        """Test that user stats have correct structure"""
        self.client.force_authenticate(user=self.admin_user)
        
        start_date = (timezone.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        end_date = timezone.now().strftime('%Y-%m-%d')
        
        url = reverse('keyword-stats')
        response = self.client.get(url, {
            'start': start_date,
            'end': end_date
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        user_stats = response.data['userStats']
        self.assertGreater(len(user_stats), 0)
        
        # Check first user stat structure
        first_stat = user_stats[0]
        self.assertIn('id', first_stat)
        self.assertIn('username', first_stat)
        self.assertIn('email', first_stat)
        self.assertIn('suggestions', first_stat)
        self.assertIn('approved', first_stat)
        self.assertIn('rejected', first_stat)
        self.assertIn('approvalRate', first_stat)
        self.assertIn('lastSuggestionDate', first_stat)
    
    def test_daily_stats_structure(self):
        """Test that daily stats have correct structure"""
        self.client.force_authenticate(user=self.admin_user)
        
        start_date = (timezone.now() - timedelta(days=3)).strftime('%Y-%m-%d')
        end_date = timezone.now().strftime('%Y-%m-%d')
        
        url = reverse('keyword-stats')
        response = self.client.get(url, {
            'start': start_date,
            'end': end_date
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        daily_stats = response.data['dailyStats']
        self.assertGreater(len(daily_stats), 0)
        
        # Check first daily stat structure
        first_stat = daily_stats[0]
        self.assertIn('date', first_stat)
        self.assertIn('suggestions', first_stat)
        self.assertIn('approved', first_stat)
        self.assertIn('rejected', first_stat)

