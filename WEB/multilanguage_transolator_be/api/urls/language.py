from django.urls import path
from api.views.language import (
    LanguageListView,
    MyCompanyLanguagesView,
)

urlpatterns = [
    path('', LanguageListView.as_view(), name='language_list'),
    path('my-company/', MyCompanyLanguagesView.as_view(), name='my_company_languages'),
]
