from django.urls import path
from ..views.convert import ConvertFileView, SupportedFormatsView

urlpatterns = [
    path('', ConvertFileView.as_view(), name='convert_file'),
    path('formats/', SupportedFormatsView.as_view(), name='supported_formats'),
]