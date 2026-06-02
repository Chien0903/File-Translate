from rest_framework import serializers


class UserStatsSerializer(serializers.Serializer):
    """Serializer for individual user statistics"""
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField()
    department = serializers.CharField(allow_null=True, required=False)
    suggestions = serializers.IntegerField()
    approved = serializers.IntegerField()
    rejected = serializers.IntegerField()
    approvalRate = serializers.CharField()
    lastSuggestionDate = serializers.DateTimeField()


class DailyStatsSerializer(serializers.Serializer):
    """Serializer for daily statistics"""
    date = serializers.DateField()
    suggestions = serializers.IntegerField()
    approved = serializers.IntegerField()
    rejected = serializers.IntegerField()


class SummaryStatsSerializer(serializers.Serializer):
    """Serializer for summary statistics"""
    totalSuggestions = serializers.IntegerField()
    totalApproved = serializers.IntegerField()
    totalRejected = serializers.IntegerField()
    totalUsers = serializers.IntegerField()
    totalKeywordsSubmitted = serializers.IntegerField(default=0)


class KeywordStatsResponseSerializer(serializers.Serializer):
    """Main response serializer for keyword statistics"""
    summary = SummaryStatsSerializer()
    userStats = UserStatsSerializer(many=True)
    dailyStats = DailyStatsSerializer(many=True)
