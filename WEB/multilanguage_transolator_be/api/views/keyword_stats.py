from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q, Max
from django.db.models.functions import TruncDate
from django.utils.dateparse import parse_date
from datetime import datetime, timedelta
from ..models.keyword import KeywordSuggestion, KeywordQueue, PrivateKeyword
from ..models.user import CustomUser
from ..serializers.keyword_stats import KeywordStatsResponseSerializer
import logging

logger = logging.getLogger(__name__)


class IsAdminUser(object):
    """
    Custom permission to only allow admin users to access the view
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == 'Admin'
        )


class KeywordStatsView(APIView):
    """
    API View for Keyword Statistics Dashboard
    Only accessible by Admin users
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        """
        Get keyword statistics for a given date range
        
        Query Parameters:
        - start: Start date (YYYY-MM-DD)
        - end: End date (YYYY-MM-DD)
        
        Returns:
        - summary: Overall statistics
        - userStats: Per-user statistics
        - dailyStats: Daily breakdown statistics
        """
        try:
            # Parse date parameters
            start_date_str = request.query_params.get('start')
            end_date_str = request.query_params.get('end')
            
            if not start_date_str or not end_date_str:
                return Response(
                    {'error': 'Both start and end date parameters are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Parse dates
            start_date = parse_date(start_date_str)
            end_date = parse_date(end_date_str)
            
            if not start_date or not end_date:
                return Response(
                    {'error': 'Invalid date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate date range
            if start_date > end_date:
                return Response(
                    {'error': 'Start date must be before end date'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Extend end_date to include the entire day
            end_date = datetime.combine(end_date, datetime.max.time())
            start_date = datetime.combine(start_date, datetime.min.time())
            
            # Get base queryset filtered by date range
            suggestions_queryset = KeywordSuggestion.objects.filter(
                created_at__range=[start_date, end_date]
            ).select_related('user')
            
            # Calculate summary statistics
            summary_stats = self._calculate_summary_stats(suggestions_queryset, start_date, end_date)
            
            # Calculate user statistics
            user_stats = self._calculate_user_stats(suggestions_queryset, start_date, end_date)
            
            # Calculate daily statistics
            daily_stats = self._calculate_daily_stats(suggestions_queryset, start_date, end_date)
            
            # Prepare response data
            response_data = {
                'summary': summary_stats,
                'userStats': user_stats,
                'dailyStats': daily_stats
            }
            
            # Validate with serializer
            serializer = KeywordStatsResponseSerializer(data=response_data)
            if serializer.is_valid():
                return Response(serializer.validated_data, status=status.HTTP_200_OK)
            else:
                logger.error(f"Serializer validation error: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            logger.error(f"Error in KeywordStatsView: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Internal server error occurred'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _calculate_summary_stats(self, queryset, start_date, end_date):
        """
        Calculate overall summary statistics
        """
        total_suggestions = queryset.count()

        total_approved = queryset.filter(status='approved').count()
        total_rejected = queryset.filter(status='rejected').count()

        total_users = queryset.values('user').distinct().count()

        total_keywords_submitted = PrivateKeyword.objects.filter(
            created_at__range=[start_date, end_date]
        ).count()

        return {
            'totalSuggestions': total_suggestions,
            'totalApproved': total_approved,
            'totalRejected': total_rejected,
            'totalUsers': total_users,
            'totalKeywordsSubmitted': total_keywords_submitted,
        }

    def _calculate_user_stats(self, queryset, start_date, end_date):
        """
        Calculate per-user statistics
        Optimized with single query using annotations
        """
        # Annotate user statistics in a single query
        user_stats = queryset.values('user', 'user__email', 'user__first_name', 'user__last_name', 'user__department').annotate(
            suggestions=Count('id'),
            approved=Count('id', filter=Q(status='approved')),
            rejected=Count('id', filter=Q(status='rejected')),
            lastSuggestionDate=Max('created_at')
        ).order_by('-suggestions')
        
        # Transform to desired format
        result = []
        for stat in user_stats:
            if not stat['user']:  # Skip if user is null
                continue
                
            # Calculate approval rate
            suggestions_count = stat['suggestions']
            approved_count = stat['approved']
            approval_rate = (approved_count / suggestions_count * 100) if suggestions_count > 0 else 0
            
            # Build username from first_name and last_name
            first_name = stat['user__first_name'] or ''
            last_name = stat['user__last_name'] or ''
            username = f"{first_name} {last_name}".strip() or stat['user__email'].split('@')[0]
            
            result.append({
                'id': stat['user'],
                'username': username,
                'email': stat['user__email'],
                'department': stat.get('user__department'),
                'suggestions': suggestions_count,
                'approved': approved_count,
                'rejected': stat['rejected'],
                'approvalRate': f"{approval_rate:.1f}",
                'lastSuggestionDate': stat['lastSuggestionDate']
            })
        
        return result

    def _calculate_daily_stats(self, queryset, start_date, end_date):
        """
        Calculate daily statistics
        Optimized with TruncDate and annotations
        """
        # Annotate daily statistics
        daily_stats = queryset.annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            suggestions=Count('id'),
            approved=Count('id', filter=Q(status='approved')),
            rejected=Count('id', filter=Q(status='rejected'))
        ).order_by('date')
        
        # Fill in missing dates with zero values
        result = []
        stats_dict = {stat['date']: stat for stat in daily_stats}
        
        current_date = start_date.date()
        end = end_date.date()
        
        while current_date <= end:
            if current_date in stats_dict:
                stat = stats_dict[current_date]
                result.append({
                    'date': current_date,
                    'suggestions': stat['suggestions'],
                    'approved': stat['approved'],
                    'rejected': stat['rejected']
                })
            else:
                # Fill missing dates with zeros
                result.append({
                    'date': current_date,
                    'suggestions': 0,
                    'approved': 0,
                    'rejected': 0
                })
            
            current_date += timedelta(days=1)
        
        return result
