from django.urls import path
from api.views.language import LanguageListView

urlpatterns = [
    path('', LanguageListView.as_view(), name='language_list'),
]
