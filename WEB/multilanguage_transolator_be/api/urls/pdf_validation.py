from django.urls import path
from ..views.pdf_validation import CheckPDFEditableView

urlpatterns = [
    path('', CheckPDFEditableView.as_view(), name='check_pdf_editable'),
]

