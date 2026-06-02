from django.urls import path
from ..views.keyword_stats import KeywordStatsView

urlpatterns = [
    path('admin/keyword-stats', KeywordStatsView.as_view(), name='keyword-stats'),
]

