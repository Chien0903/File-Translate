from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, BasePermission
import hashlib
import re
import unicodedata
from itertools import combinations

from ..models.keyword import KeywordSuggestion, KeywordQueue, PrivateKeyword, LibraryQueueSettings
from ..models.notification import Notification
from ..serializers.keyword import KeywordSuggestionSerializer, KeywordQueueSerializer, PrivateKeywordSerializer
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Q, Value, CharField
from django.db.models.functions import Concat
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import os
import logging
from collections import defaultdict

from ..services.glossary_service import (
    create_glossary_csv_file,
    upload_csv_to_gcs,
    manage_all_glossaries,
    async_manage_common_glossaries,
)

from dotenv import load_dotenv
from google.cloud import storage

load_dotenv()
logger = logging.getLogger(__name__)


class IsAdminOrLibraryKeeper(BasePermission):
    """
    Custom permission to allow Admin or Library Keeper to approve keyword suggestions
    """
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            (request.user.is_staff or 
             request.user.role in ['Admin', 'Library Keeper'])
        )


def _check_admin_or_keeper(user):
    """Helper to check if user is Admin or Library Keeper."""
    return user.is_staff or getattr(user, 'role', '') in ['Admin', 'Library Keeper']


# ======= Fields used for duplicate checking =======
DUPLICATE_CHECK_FIELDS = [
    'japanese', 'english', 'vietnamese',
    'chinese_traditional', 'chinese_simplified',
    'thai', 'bengali', 'hindi', 'indonesian', 'oriya'
]

PRIVATE_DUP_PLACEHOLDERS = {"", "-", "—", "–", "null", "none", ".."}


def _normalize_private_pair_value(value):
    s = (value or "").strip().lower()
    return "" if s in PRIVATE_DUP_PLACEHOLDERS else s


def _build_private_pair_keys_from_mapping(mapping):
    """
    Build pair keys from private keyword payload.
    Only non-empty pairs are considered for duplicate checking.
    """
    normalized = {
        f: _normalize_private_pair_value(mapping.get(f, ""))
        for f in DUPLICATE_CHECK_FIELDS
    }
    keys = set()
    for field_a, field_b in combinations(DUPLICATE_CHECK_FIELDS, 2):
        va = normalized.get(field_a, "")
        vb = normalized.get(field_b, "")
        if not va or not vb:
            continue
        keys.add((field_a, field_b, va, vb))
    return keys


def _find_private_pair_conflict(user, candidate_mapping, exclude_private_id=None):
    """
    Return first conflicting private keyword id if any pair matches within the same user.
    Empty pairs are ignored.
    """
    candidate_pairs = _build_private_pair_keys_from_mapping(candidate_mapping)
    if not candidate_pairs:
        return None

    queryset = PrivateKeyword.objects.filter(user=user)
    if exclude_private_id is not None:
        queryset = queryset.exclude(id=exclude_private_id)

    for row in queryset.values("id", *DUPLICATE_CHECK_FIELDS):
        row_pairs = _build_private_pair_keys_from_mapping(row)
        if candidate_pairs.intersection(row_pairs):
            return row["id"]
    return None


def _find_thk_pair_conflict(candidate_mapping, exclude_suggestion_id=None):
    """
    Return first conflicting approved THK keyword id if any pair matches.
    Empty pairs are ignored.
    """
    candidate_pairs = _build_private_pair_keys_from_mapping(candidate_mapping)
    if not candidate_pairs:
        return None

    queryset = KeywordSuggestion.objects.filter(status='approved')
    if exclude_suggestion_id is not None:
        queryset = queryset.exclude(id=exclude_suggestion_id)

    for row in queryset.values("id", *DUPLICATE_CHECK_FIELDS):
        row_pairs = _build_private_pair_keys_from_mapping(row)
        if candidate_pairs.intersection(row_pairs):
            return row["id"]
    return None


def _check_keyword_duplicates(keyword):
    """
    Check if any single non-empty field of the keyword matches an approved record.
    Returns list of duplicate info dicts, or empty list if no duplicates.
    """
    duplicates = []
    approved_qs = KeywordSuggestion.objects.filter(status='approved')

    for field_name in DUPLICATE_CHECK_FIELDS:
        value = getattr(keyword, field_name, None)
        if value is None:
            continue
        normalized = str(value).strip()
        if not normalized:
            continue
        filter_kwargs = {f"{field_name}__iexact": normalized}
        conflicts_qs = approved_qs.filter(**filter_kwargs)
        if conflicts_qs.exists():
            conflict_ids = list(conflicts_qs.values_list('id', flat=True)[:5])
            duplicates.append({
                'field': field_name,
                'value': normalized,
                'conflict_ids': conflict_ids
            })

    return duplicates


def _content_signature(keyword):
    """Chữ ký nội dung để gom các đề xuất pending trùng nội dung."""
    parts = []
    for field_name in DUPLICATE_CHECK_FIELDS:
        value = getattr(keyword, field_name, None)
        if value is None:
            continue
        normalized = str(value).strip()
        if not normalized:
            continue
        parts.append(f"{field_name}:{normalized.lower()}")
    if not parts:
        return ""
    return hashlib.sha256("|".join(sorted(parts)).encode("utf-8")).hexdigest()


LANGUAGE_FIELD_LABELS = {
    'japanese': 'Japanese',
    'english': 'English',
    'vietnamese': 'Vietnamese',
    'chinese_traditional': 'Chinese (Traditional)',
    'chinese_simplified': 'Chinese (Simplified)',
    'thai': 'Thai',
    'bengali': 'Bengali',
    'hindi': 'Hindi',
    'indonesian': 'Indonesian',
    'oriya': 'Oriya',
}


def _normalize_queue_text(value):
    """
    Chuẩn hóa giá trị khi gom cặp: NFKC, gom dấu nháy đơn, bỏ ký tự zero-width,
    gom khoảng trắng, không phân biệt hoa thường (Latin).
    Tránh lệch do ' (ASCII) vs ' (U+2019) hoặc full-width khi hai user nhập khác nhau.
    """
    if value is None:
        return ''
    s = str(value).strip()
    if not s:
        return ''
    s = unicodedata.normalize('NFKC', s)
    for z in ('\u200b', '\u200c', '\u200d', '\ufeff'):
        s = s.replace(z, '')
    for ch in ('\u2019', '\u2018', '\u02b9', '\u02bc', '\uff07'):
        s = s.replace(ch, "'")
    s = re.sub(r'\s+', ' ', s)
    return s.lower()


def _pair_values_queue_key(field_a, field_b, val_a, val_b):
    """Cùng một cặp ngôn ngữ + cùng hai giá trị sau chuẩn hóa."""
    a = _normalize_queue_text(val_a)
    b = _normalize_queue_text(val_b)
    return f"{field_a}|{field_b}|{a}|{b}"


def _reject_other_pending_same_content(approved_suggestion):
    """Sau khi duyệt một đề xuất, từ chối các pending khác cùng nội dung."""
    sig = _content_signature(approved_suggestion)
    if not sig:
        return
    for s in KeywordSuggestion.objects.filter(status='pending').exclude(id=approved_suggestion.id):
        if _content_signature(s) == sig:
            s.status = 'rejected'
            s.save(update_fields=['status', 'updated_at'])


def _notify_admins_about_duplicate_suggestion(suggestion, duplicates):
    """Tạo notification cho admin/keeper khi suggestion đạt threshold nhưng trùng library."""
    User = get_user_model()
    admins = User.objects.filter(
        Q(is_staff=True) | Q(role__in=['Admin', 'Library Keeper'])
    )
    dup_fields = ', '.join(
        f'{d["field"]}="{d["value"]}"' for d in duplicates[:3]
    )
    for admin in admins:
        Notification.objects.create(
            user=admin,
            title="Duplicate Suggestion Detected",
            message=(
                f"A suggestion reached the auto-approve threshold but conflicts "
                f"with an existing library entry. Overlapping: {dup_fields}. "
                f"Please review manually in 'Suggestion search'."
            ),
            details=True,
            keyword_details=[{
                "suggestion_id": suggestion.id,
                "japanese": suggestion.japanese,
                "english": suggestion.english,
                "vietnamese": suggestion.vietnamese,
                "chinese_traditional": suggestion.chinese_traditional,
                "chinese_simplified": suggestion.chinese_simplified,
            }],
        )


def _check_full_duplicate_for_auto_approve(suggestion):
    """
    Kiểm tra xem có entry approved nào trùng TẤT CẢ các field non-empty
    của suggestion hay không (full-content duplicate).
    Khác với _check_keyword_duplicates (chỉ cần 1 field trùng).
    Returns list of conflict dicts, or empty list.
    """
    filter_kwargs = {}
    for field_name in DUPLICATE_CHECK_FIELDS:
        value = getattr(suggestion, field_name, None)
        if value is None:
            continue
        normalized = str(value).strip()
        if not normalized:
            continue
        filter_kwargs[f"{field_name}__iexact"] = normalized

    if not filter_kwargs:
        return []

    conflicts = KeywordSuggestion.objects.filter(
        status='approved', **filter_kwargs
    )
    if not conflicts.exists():
        return []

    return [{
        'field': 'all_fields',
        'value': ', '.join(f'{k}' for k in filter_kwargs.keys()),
        'conflict_ids': list(conflicts.values_list('id', flat=True)[:5]),
    }]


def _try_auto_approve_on_threshold():
    """
    Kiểm tra tất cả pending suggestions: nếu có cặp ngôn ngữ nào đạt ngưỡng
    (min_n distinct users), tự động approve (thêm thẳng vào Common Library).
    Nếu trùng hoàn toàn với từ đã approved → tạo notification cho admin/keeper.
    Returns list of auto-approved suggestion IDs.
    """
    settings = LibraryQueueSettings.load()
    min_n = settings.min_suggesters_for_queue

    pending = list(
        KeywordSuggestion.objects.filter(status='pending').select_related('user')
    )
    if not pending:
        logger.info("[auto-approve] No pending suggestions found.")
        return []

    logger.info(
        "[auto-approve] Checking %d pending suggestions, threshold=%d",
        len(pending), min_n,
    )
    approved_ids = set()

    for field_a, field_b in combinations(DUPLICATE_CHECK_FIELDS, 2):
        groups = {}
        for s in pending:
            if s.id in approved_ids:
                continue
            val_a = getattr(s, field_a, None)
            val_b = getattr(s, field_b, None)
            if val_a is None or val_b is None:
                continue
            sa = str(val_a).strip()
            sb = str(val_b).strip()
            if not sa or not sb:
                continue
            gkey = _pair_values_queue_key(field_a, field_b, sa, sb)
            groups.setdefault(gkey, []).append(s)

        for gkey, group in groups.items():
            tokens = set()
            for s in group:
                if s.user_id is not None:
                    tokens.add(f"u:{s.user_id}")
                else:
                    tokens.add(f"row:{s.id}")
            distinct = len(tokens)
            if distinct < min_n:
                continue

            group.sort(key=lambda x: x.id)
            rep = group[0]
            if rep.status != 'pending' or rep.id in approved_ids:
                continue

            logger.info(
                "[auto-approve] Pair (%s, %s) has %d distinct users, "
                "representative suggestion #%d. Checking full-content duplicate…",
                field_a, field_b, distinct, rep.id,
            )

            duplicates = _check_full_duplicate_for_auto_approve(rep)
            if duplicates:
                logger.info(
                    "[auto-approve] Suggestion #%d is a full duplicate of "
                    "existing library entry. Notifying admins.",
                    rep.id,
                )
                _notify_admins_about_duplicate_suggestion(rep, duplicates)
                continue

            rep.status = 'approved'
            rep.save(update_fields=['status', 'updated_at'])
            approved_ids.add(rep.id)
            _reject_other_pending_same_content(rep)

            logger.info(
                "[auto-approve] Suggestion #%d auto-approved successfully.", rep.id,
            )

            User = get_user_model()
            for user in User.objects.all():
                Notification.objects.create(
                    user=user,
                    title="New Keyword Added",
                    message="A keyword has been automatically added to the library (threshold reached).",
                    details=True,
                    keyword_details=[{
                        "japanese": rep.japanese,
                        "english": rep.english,
                        "vietnamese": rep.vietnamese,
                        "chinese_traditional": rep.chinese_traditional,
                        "chinese_simplified": rep.chinese_simplified,
                    }],
                )

    logger.info("[auto-approve] Done. Auto-approved IDs: %s", list(approved_ids))
    if approved_ids:
        async_manage_common_glossaries()
    return list(approved_ids)


# ======= Keyword CRUD Views (CBV) =======

class ReviewSuggestionView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        try: 
            suggestion = KeywordSuggestion.objects.get(id=pk)
        except KeywordSuggestion.DoesNotExist:
            return Response({"detail": "Suggestion not found"}, status=status.HTTP_404_NOT_FOUND)
        
        if suggestion.status != 'pending':
            return Response({"detail": "Suggestion has already been approved"}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = KeywordSuggestionSerializer(suggestion, data=request.data, partial=True)
        if serializer.is_valid():
            suggestion = serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            

class ApproveSuggestionView(APIView):
    permission_classes = [IsAdminOrLibraryKeeper]

    def post(self, request, pk):
        try:
            suggestion = KeywordSuggestion.objects.get(id=pk)
        except KeywordSuggestion.DoesNotExist:
            return Response({"detail": "Not found"}, status=404)

        if suggestion.status != 'pending':
            return Response({"detail": "Suggestion has already been approved"}, status=400)

        resolution = request.data.get('duplicate_resolution')

        try:
            duplicates = _check_keyword_duplicates(suggestion)
        except Exception as e:
            return Response({
                'error': f'Failed to check duplicates: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if duplicates:
            if resolution is None:
                first_id = duplicates[0]['conflict_ids'][0]
                try:
                    existing = KeywordSuggestion.objects.get(id=first_id, status='approved')
                except KeywordSuggestion.DoesNotExist:
                    return Response({'error': 'Conflict target not found'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                return Response({
                    'detail': 'duplicate_conflict',
                    'duplicates': duplicates,
                    'existing_approved': KeywordSuggestionSerializer(existing).data,
                    'pending_suggestion': KeywordSuggestionSerializer(suggestion).data,
                }, status=409)

            if resolution == 'keep_library':
                suggestion.status = 'rejected'
                suggestion.save(update_fields=['status', 'updated_at'])
                return Response({'message': 'Suggestion rejected (library kept intact).'})

            if resolution == 'use_pending':
                target_id = request.data.get('replace_target_id') or duplicates[0]['conflict_ids'][0]
                try:
                    existing = KeywordSuggestion.objects.get(id=target_id, status='approved')
                except KeywordSuggestion.DoesNotExist:
                    return Response({'error': 'Target approved keyword not found'}, status=400)

                sig = _content_signature(suggestion)
                for field_name in DUPLICATE_CHECK_FIELDS:
                    setattr(existing, field_name, getattr(suggestion, field_name, None))
                existing.save()

                for s in KeywordSuggestion.objects.filter(status='pending').exclude(id=suggestion.id):
                    if _content_signature(s) == sig:
                        s.status = 'rejected'
                        s.save(update_fields=['status', 'updated_at'])

                suggestion.delete()
                async_manage_common_glossaries()
                return Response({'message': 'Library entry updated from suggestion.'})

            return Response({'error': 'Invalid duplicate_resolution'}, status=400)

        suggestion.status = 'approved'
        suggestion.approved_by = request.user
        suggestion.save()

        _reject_other_pending_same_content(suggestion)
        async_manage_common_glossaries()

        User = get_user_model()
        users = User.objects.all()

        for user in users:
            Notification.objects.create(
                user=user,
                title="New Keyword Added",
                message="A new keyword has been added to the library.",
                details=True,
                keyword_details=[{
                    "japanese": suggestion.japanese,
                    "english": suggestion.english,
                    "vietnamese": suggestion.vietnamese,
                    "chinese_traditional": suggestion.chinese_traditional,
                    "chinese_simplified": suggestion.chinese_simplified
                }]
            )

        return Response({"message": "Suggestion approved!"})


@method_decorator(csrf_exempt, name='dispatch')
class DeleteSuggestionView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            suggestion = KeywordSuggestion.objects.get(id=pk)
        except KeywordSuggestion.DoesNotExist:
            logger.warning(f"Keyword {pk} not found for deletion")
            return Response({"detail": "Suggestion not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check permissions: owner, staff, or Admin/Library Keeper
        user_is_owner = request.user == suggestion.user
        if not (user_is_owner or _check_admin_or_keeper(request.user)):
            logger.warning(f"Permission denied for user {request.user.id} to delete keyword {pk}")
            return Response(
                {"detail": "Permission denied. Only admin, library keeper, or keyword creator can delete."},
                status=status.HTTP_403_FORBIDDEN
            )

        was_approved = suggestion.status == 'approved'
        suggestion.delete()
        logger.info(f"Successfully deleted keyword {pk} by user {request.user.id}")
        if was_approved:
            async_manage_common_glossaries()
        return Response({"message": "Suggestion deleted successfully"}, status=status.HTTP_204_NO_CONTENT)


class UpdateKeywordView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        try:
            keyword = KeywordSuggestion.objects.get(id=pk)
        except KeywordSuggestion.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if keyword.status == 'approved':
            candidate_payload = {
                f: request.data.get(f, getattr(keyword, f, ""))
                for f in DUPLICATE_CHECK_FIELDS
            }
            conflict_id = _find_thk_pair_conflict(
                candidate_mapping=candidate_payload,
                exclude_suggestion_id=keyword.id,
            )
            if conflict_id:
                return Response(
                    {
                        "detail": (
                            "Duplicate detected: at least one language pair already exists "
                            f"in Common Library (approved id={conflict_id})."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = KeywordSuggestionSerializer(keyword, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            if keyword.status == 'approved':
                async_manage_common_glossaries()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ======= Keyword List/Create (FBV) =======

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def keyword_suggestions_list_create(request):
    """Get all keyword suggestions with optional filtering or create new suggestion"""
    
    if request.method == 'GET':
        try:
            queryset = KeywordSuggestion.objects.all().order_by('-created_at')

            status_filter = request.GET.get('status')
            if status_filter:
                queryset = queryset.filter(status=status_filter)

            search = request.GET.get('search', '').strip()
            if search:
                queryset = queryset.filter(
                    Q(japanese__icontains=search) |
                    Q(english__icontains=search) |
                    Q(vietnamese__icontains=search) |
                    Q(chinese_traditional__icontains=search) |
                    Q(chinese_simplified__icontains=search) |
                    Q(thai__icontains=search) |
                    Q(bengali__icontains=search) |
                    Q(hindi__icontains=search) |
                    Q(indonesian__icontains=search) |
                    Q(oriya__icontains=search)
                )

            total = queryset.count()

            try:
                page_size = max(1, min(int(request.GET.get('page_size', 50)), 5000))
            except (TypeError, ValueError):
                page_size = 50
            try:
                page = max(1, int(request.GET.get('page', 1)))
            except (TypeError, ValueError):
                page = 1

            start = (page - 1) * page_size
            page_qs = queryset[start:start + page_size]

            serializer = KeywordSuggestionSerializer(page_qs, many=True)
            return Response(
                {
                    'results': serializer.data,
                    'total': total,
                    'page': page,
                    'page_size': page_size,
                    'total_pages': max(1, (total + page_size - 1) // page_size),
                },
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            return Response(
                {'error': f'Failed to fetch keyword suggestions: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    elif request.method == 'POST':
        try:
            suggestion_payload = {
                'japanese': request.data.get('japanese', ''),
                'english': request.data.get('english', ''),
                'vietnamese': request.data.get('vietnamese', ''),
                'chinese_traditional': request.data.get('chinese_traditional', ''),
                'chinese_simplified': request.data.get('chinese_simplified', ''),
                'thai': request.data.get('thai', ''),
                'bengali': request.data.get('bengali', ''),
                'hindi': request.data.get('hindi', ''),
                'indonesian': request.data.get('indonesian', ''),
                'oriya': request.data.get('oriya', ''),
                'status': 'pending',
                'suggestion_count': 1,
                'frequency_percentage': 0.0
            }

            suggestion_serializer = KeywordSuggestionSerializer(data=suggestion_payload, context={'request': request})
            if suggestion_serializer.is_valid():
                suggestion = suggestion_serializer.save()
                logger.info(f"Created new keyword suggestion {suggestion.id} by user {request.user.id}")
                auto_approved = _try_auto_approve_on_threshold()
                data = suggestion_serializer.data
                if auto_approved:
                    data['auto_approved_ids'] = auto_approved
                return Response(data, status=status.HTTP_201_CREATED)
            else:
                logger.error(f"Validation errors: {suggestion_serializer.errors}")
                return Response(suggestion_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Failed to create suggestion directly: {e}")
            return Response(
                {'error': f'Failed to create suggestion: {str(e)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ======= GCS Upload Endpoints =======

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_keywords_to_gcs(request):
    """Extract keywords to CSV file and upload to GCS, then update glossaries"""
    csv_file_path = None
    try:
        if not _check_admin_or_keeper(request.user):
            return Response(
                {'error': 'Permission denied. Admin or Library Keeper access required.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Step 1: Create CSV from approved keywords
        csv_file_path = create_glossary_csv_file()
        
        if not csv_file_path:
            return Response(
                {'error': 'No approved keywords found to upload'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Step 2: Upload CSV to GCS
        try:
            gcs_url = upload_csv_to_gcs(csv_file_path)
            logger.info(f"Successfully uploaded CSV to: {gcs_url}")
        except Exception as upload_error:
            logger.error(f"Upload error: {str(upload_error)}")
            return Response(
                {'error': f'Upload failed: {str(upload_error)}'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Step 3: Update all glossaries
        glossary_results = []
        glossary_errors = []
        
        try:
            results, errors = manage_all_glossaries(mode=1)
            glossary_results = results
            glossary_errors = errors
            
            logger.info(f"Updated {len(results)} glossaries successfully")
            if errors:
                logger.warning(f"Failed to update {len(errors)} glossaries: {errors}")
                
        except Exception as glossary_error:
            logger.error(f"Error managing glossaries: {str(glossary_error)}")
            glossary_errors.append({
                'error': f'Failed to manage glossaries: {str(glossary_error)}'
            })
        
        approved_count = KeywordSuggestion.objects.filter(status='approved').count()
        
        return Response({
            'message': 'Keywords extracted to CSV, uploaded to GCS and glossaries updated successfully',
            'details': {
                'csv_file_created': True,
                'gcs_url': gcs_url,
                'approved_keywords_count': approved_count,
                'glossary_updates': {
                    'successful': len(glossary_results),
                    'failed': len(glossary_errors),
                    'results': glossary_results,
                    'errors': glossary_errors if glossary_errors else None
                }
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Failed to upload keywords to GCS: {str(e)}")
        return Response(
            {'error': f'Failed to upload keywords to GCS: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    finally:
        if csv_file_path and os.path.exists(csv_file_path):
            try:
                os.unlink(csv_file_path)
                logger.info(f"Cleaned up temporary CSV file: {csv_file_path}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup CSV file: {cleanup_error}")


DUPLICATE_ALERT_TITLE = "Duplicate Suggestion Detected"


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def duplicate_alerts_list(request):
    """Return unread duplicate-alert notifications for the current admin/keeper,
    enriched with the pending suggestion and the conflicting library entry."""
    if not _check_admin_or_keeper(request.user):
        return Response(
            {'error': 'Permission denied.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    notifs = Notification.objects.filter(
        user=request.user,
        title=DUPLICATE_ALERT_TITLE,
        read=False,
    ).order_by('-created_at')

    results = []
    for n in notifs:
        kd = (n.keyword_details or [{}])[0] if n.keyword_details else {}
        suggestion_id = kd.get('suggestion_id')
        suggestion_data = None
        existing_data = None

        if suggestion_id:
            try:
                s = KeywordSuggestion.objects.get(id=suggestion_id)
                suggestion_data = {
                    'id': s.id,
                    'status': s.status,
                    'japanese': s.japanese,
                    'english': s.english,
                    'vietnamese': s.vietnamese,
                    'chinese_traditional': s.chinese_traditional,
                    'chinese_simplified': s.chinese_simplified,
                    'thai': s.thai,
                    'bengali': s.bengali,
                    'hindi': s.hindi,
                    'indonesian': s.indonesian,
                    'oriya': s.oriya,
                }
                duplicates = _check_keyword_duplicates(s)
                if duplicates:
                    first_id = duplicates[0]['conflict_ids'][0]
                    try:
                        ex = KeywordSuggestion.objects.get(id=first_id, status='approved')
                        existing_data = {
                            'id': ex.id,
                            'japanese': ex.japanese,
                            'english': ex.english,
                            'vietnamese': ex.vietnamese,
                            'chinese_traditional': ex.chinese_traditional,
                            'chinese_simplified': ex.chinese_simplified,
                            'thai': ex.thai,
                            'bengali': ex.bengali,
                            'hindi': ex.hindi,
                            'indonesian': ex.indonesian,
                            'oriya': ex.oriya,
                        }
                    except KeywordSuggestion.DoesNotExist:
                        pass
            except KeywordSuggestion.DoesNotExist:
                pass

        results.append({
            'notification_id': n.id,
            'message': n.message,
            'created_at': n.created_at.isoformat() if n.created_at else None,
            'suggestion': suggestion_data,
            'existing_library': existing_data,
        })

    return Response({
        'alerts': results,
        'total': len(results),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def duplicate_alert_dismiss(request, pk):
    """Mark a duplicate-alert notification as read (dismiss)."""
    if not _check_admin_or_keeper(request.user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
    try:
        n = Notification.objects.get(id=pk, user=request.user, title=DUPLICATE_ALERT_TITLE)
    except Notification.DoesNotExist:
        return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
    n.read = True
    n.save(update_fields=['read'])
    return Response({'message': 'Dismissed.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_gcs_upload_status(request):
    """Get status information about GCS upload"""
    try:
        total_keywords = KeywordSuggestion.objects.count()
        approved_keywords = KeywordSuggestion.objects.filter(status='approved').count()
        pending_keywords = KeywordSuggestion.objects.filter(status='pending').count()
        
        # Check file on GCS
        bucket_name = os.getenv("BUCKET_NAME", "toray-buckets")
        destination_blob_name = "glossary_term.csv"
        
        gcs_info = None
        try:
            storage_client = storage.Client()
            bucket = storage_client.bucket(bucket_name)
            blob = bucket.blob(destination_blob_name)
            
            if blob.exists():
                blob.reload()
                gcs_info = {
                    'exists': True,
                    'size': blob.size,
                    'updated': blob.updated.isoformat() if blob.updated else None,
                    'url': f'gs://{bucket_name}/{destination_blob_name}'
                }
            else:
                gcs_info = {'exists': False}
        except Exception as gcs_error:
            gcs_info = {'error': str(gcs_error)}
        
        return Response({
            'keywords_stats': {
                'total': total_keywords,
                'approved': approved_keywords,
                'pending': pending_keywords
            },
            'gcs_file': gcs_info,
            'can_upload': approved_keywords > 0,
            'user_permissions': {
                'can_upload': _check_admin_or_keeper(request.user)
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {'error': f'Failed to get upload status: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def suggestion_queue_settings(request):
    """Ngưỡng số người đề xuất tối thiểu để từ vào hàng chờ (Admin / Library Keeper chỉnh PATCH)."""
    settings = LibraryQueueSettings.load()
    if request.method == 'GET':
        return Response({'min_suggesters_for_queue': settings.min_suggesters_for_queue})
    if request.method == 'PATCH':
        if not _check_admin_or_keeper(request.user):
            return Response(
                {'error': 'Permission denied. Admin or Library Keeper access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        val = request.data.get('min_suggesters_for_queue')
        if val is None:
            return Response({'error': 'min_suggesters_for_queue is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            v = int(val)
            if v < 2 or v > 9999:
                raise ValueError()
        except (TypeError, ValueError):
            return Response({'error': 'min_suggesters_for_queue must be between 2 and 9999'}, status=status.HTTP_400_BAD_REQUEST)
        settings.min_suggesters_for_queue = v
        settings.save()
        # Re-evaluate pending suggestions immediately after threshold change.
        auto_approved_ids = _try_auto_approve_on_threshold()
        return Response({
            'min_suggesters_for_queue': settings.min_suggesters_for_queue,
            'auto_approved_ids': auto_approved_ids,
            'auto_approved_count': len(auto_approved_ids),
        })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def suggestion_queue_list(request):
    """
    Search pending suggestions by user name / email.
    Returns empty list when no search term is provided (modal starts empty).
    """
    if not _check_admin_or_keeper(request.user):
        return Response(
            {'error': 'Permission denied. Admin or Library Keeper access required.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    search = (request.GET.get('search') or '').strip()

    if not search:
        return Response({
            'suggestions': [],
            'total': 0,
            'page': 1,
            'page_size': 8,
            'total_pages': 1,
        })

    def _token_q(token):
        """Tạo Q khớp token trên tất cả field user + keyword content."""
        return (
            Q(user__first_name__icontains=token)
            | Q(user__last_name__icontains=token)
            | Q(user__email__icontains=token)
            | Q(full_name__icontains=token)
            | Q(japanese__icontains=token)
            | Q(english__icontains=token)
            | Q(vietnamese__icontains=token)
            | Q(chinese_traditional__icontains=token)
            | Q(chinese_simplified__icontains=token)
            | Q(thai__icontains=token)
            | Q(bengali__icontains=token)
            | Q(hindi__icontains=token)
            | Q(indonesian__icontains=token)
            | Q(oriya__icontains=token)
        )

    # Tách query theo dấu phẩy → AND từng token
    tokens = [t.strip() for t in search.split(',') if t.strip()]
    if not tokens:
        return Response({'suggestions': [], 'total': 0, 'page': 1, 'page_size': 8, 'total_pages': 1})

    queryset = KeywordSuggestion.objects.filter(
        status='pending',
    ).select_related('user').annotate(
        full_name=Concat(
            'user__first_name', Value(' '), 'user__last_name',
            output_field=CharField()
        )
    )
    for token in tokens:
        queryset = queryset.filter(_token_q(token))
    queryset = queryset.order_by('-created_at')


    total = queryset.count()

    try:
        page_size = int(request.GET.get('page_size', 8))
    except (TypeError, ValueError):
        page_size = 8
    page_size = max(1, min(page_size, 50))

    try:
        page = int(request.GET.get('page', 1))
    except (TypeError, ValueError):
        page = 1
    page = max(1, page)

    total_pages = max(1, (total + page_size - 1) // page_size) if total else 1
    if page > total_pages:
        page = total_pages

    start = (page - 1) * page_size
    items = queryset[start:start + page_size]

    result = []
    for s in items:
        user_display = ''
        if s.user:
            full = f"{s.user.first_name or ''} {s.user.last_name or ''}".strip()
            user_display = full or s.user.email
        result.append({
            'id': s.id,
            'user_id': s.user_id,
            'user_display': user_display,
            'user_email': s.user.email if s.user else None,
            'japanese': s.japanese,
            'english': s.english,
            'vietnamese': s.vietnamese,
            'chinese_traditional': s.chinese_traditional,
            'chinese_simplified': s.chinese_simplified,
            'thai': s.thai,
            'bengali': s.bengali,
            'hindi': s.hindi,
            'indonesian': s.indonesian,
            'oriya': s.oriya,
            'status': s.status,
            'created_at': s.created_at.isoformat() if s.created_at else None,
        })

    return Response({
        'suggestions': result,
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages,
    })


# ======= Queue Management Endpoints =======

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_keyword_queue_api(request):
    """API endpoint to trigger keyword queue processing manually"""
    try:
        if not _check_admin_or_keeper(request.user):
            return Response(
                {'error': 'Permission denied. Admin or Library Keeper access required.'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        min_frequency = float(request.data.get('min_frequency', 2.0))
        dry_run = request.data.get('dry_run', False)
        
        from django.core.management import call_command
        from io import StringIO
        import sys
        
        old_stdout = sys.stdout
        sys.stdout = output = StringIO()
        
        try:
            call_command('process_keyword_queue', 
                        min_frequency=min_frequency, 
                        dry_run=dry_run)
            command_output = output.getvalue()
        finally:
            sys.stdout = old_stdout
            
        queue_stats = {
            'total_queue_items': KeywordQueue.objects.count(),
            'unprocessed_items': KeywordQueue.objects.filter(is_processed=False).count(),
            'processed_items': KeywordQueue.objects.filter(is_processed=True).count(),
            'total_suggestions': KeywordSuggestion.objects.count(),
            'pending_suggestions': KeywordSuggestion.objects.filter(status='pending').count(),
            'approved_suggestions': KeywordSuggestion.objects.filter(status='approved').count()
        }
        
        return Response({
            'message': 'Queue processing completed successfully',
            'details': {
                'command_output': command_output,
                'parameters': {
                    'min_frequency': min_frequency,
                    'dry_run': dry_run
                },
                'statistics': queue_stats
            }
        }, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response(
            {'error': f'Invalid parameters: {str(e)}'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Error processing keyword queue: {str(e)}")
        return Response(
            {'error': f'Failed to process keyword queue: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_queue_status(request):
    """Get current status of keyword queue"""
    try:
        user_only = request.GET.get('user_only', '').lower() == 'true'
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        
        if user_only:
            # Statistics for current user
            total = KeywordSuggestion.objects.filter(user=request.user).count()
            pending = KeywordSuggestion.objects.filter(user=request.user, status='pending').count()
            approved = KeywordSuggestion.objects.filter(user=request.user, status='approved').count()
            
            queue_stats = {
                'total_queue_items': total,
                'unprocessed_items': pending,
                'processed_items': approved,
                'total_suggestions': total,
                'pending_suggestions': pending,
                'approved_suggestions': approved
            }
            
            user_suggestions = KeywordSuggestion.objects.filter(
                user=request.user
            ).order_by('-created_at')[start_idx:end_idx]
            
            queue_items_data = [{
                'id': s.id,
                'user': s.user.id if s.user else None,
                'japanese': s.japanese,
                'english': s.english,
                'vietnamese': s.vietnamese,
                'chinese_traditional': s.chinese_traditional,
                'chinese_simplified': s.chinese_simplified,
                'thai': s.thai,
                'bengali': s.bengali,
                'hindi': s.hindi,
                'indonesian': s.indonesian,
                'oriya': s.oriya,
                'is_processed': s.status == 'approved',
                'processed_at': s.updated_at if s.status == 'approved' else None,
                'created_at': s.created_at
            } for s in user_suggestions]
            
            recent_suggestions = KeywordSuggestion.objects.filter(
                user=request.user, status='pending'
            ).order_by('-created_at')[:10]
            
            queue_items = queue_items_data
        else:
            # Admin: total statistics
            queue_stats = {
                'total_queue_items': KeywordQueue.objects.count(),
                'unprocessed_items': KeywordQueue.objects.filter(is_processed=False).count(),
                'processed_items': KeywordQueue.objects.filter(is_processed=True).count(),
                'total_suggestions': KeywordSuggestion.objects.count(),
                'pending_suggestions': KeywordSuggestion.objects.filter(status='pending').count(),
                'approved_suggestions': KeywordSuggestion.objects.filter(status='approved').count()
            }
            
            all_queue = KeywordQueue.objects.all().order_by('-created_at')
            queue_items_qs = all_queue[start_idx:end_idx]
            queue_items = KeywordQueueSerializer(queue_items_qs, many=True).data
            
            recent_suggestions = KeywordSuggestion.objects.filter(
                status='pending'
            ).order_by('-created_at')[:10]
        
        return Response({
            'statistics': queue_stats,
            'queue_items': queue_items,
            'total_queue_items': queue_stats['total_queue_items'],
            'recent_suggestions': KeywordSuggestionSerializer(recent_suggestions, many=True).data,
            'can_process': queue_stats['unprocessed_items'] > 0,
            'user_permissions': {
                'can_process_queue': _check_admin_or_keeper(request.user)
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response(
            {'error': f'Failed to get queue status: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# ===== Private Library Views =====

class PrivateKeywordListCreateView(APIView):
    """List and create private keywords for the authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        keywords = PrivateKeyword.objects.filter(user=request.user).select_related('user', 'suggestion')
        serializer = PrivateKeywordSerializer(keywords, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        data = request.data
        language_fields = [
            'japanese', 'english', 'vietnamese', 'chinese_traditional',
            'chinese_simplified', 'thai', 'bengali', 'hindi', 'indonesian', 'oriya'
        ]
        has_content = any(data.get(f, '').strip() for f in language_fields if isinstance(data.get(f, ''), str))
        if not has_content:
            return Response(
                {'error': 'At least one language field is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        candidate_payload = {f: data.get(f, "") for f in language_fields}
        conflict_id = _find_private_pair_conflict(
            user=request.user,
            candidate_mapping=candidate_payload,
        )
        if conflict_id:
            return Response(
                {
                    "error": (
                        "Duplicate detected: at least one language pair already exists "
                        f"in your private library (conflict id={conflict_id})."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = PrivateKeywordSerializer(data=data, context={'request': request})
        if serializer.is_valid():
            serializer.save(user=request.user)
            from ..services.glossary_service import async_manage_user_glossaries
            async_manage_user_glossaries(request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PrivateKeywordDetailView(APIView):
    """Retrieve, update, or delete a single private keyword (owner only)."""
    permission_classes = [IsAuthenticated]

    def _get_object(self, pk, user):
        try:
            return PrivateKeyword.objects.get(pk=pk, user=user)
        except PrivateKeyword.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get_object(pk, request.user)
        if not obj:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PrivateKeywordSerializer(obj).data)

    def put(self, request, pk):
        obj = self._get_object(pk, request.user)
        if not obj:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        CONTENT_FIELDS = [
            'japanese', 'english', 'vietnamese', 'chinese_traditional',
            'chinese_simplified', 'thai', 'bengali', 'hindi', 'indonesian', 'oriya',
        ]
        # Nếu bất kỳ trường nội dung nào thay đổi → reset suggestion link
        # (suggestion cũ không còn phản ánh đúng nội dung nữa)
        content_changed = any(
            field in request.data and request.data[field] != getattr(obj, field, None)
            for field in CONTENT_FIELDS
        )
        reset_suggestion = content_changed and obj.suggestion_id is not None

        candidate_payload = {
            f: request.data.get(f, getattr(obj, f, ""))
            for f in CONTENT_FIELDS
        }
        conflict_id = _find_private_pair_conflict(
            user=request.user,
            candidate_mapping=candidate_payload,
            exclude_private_id=obj.id,
        )
        if conflict_id:
            return Response(
                {
                    "error": (
                        "Duplicate detected: at least one language pair already exists "
                        f"in your private library (conflict id={conflict_id})."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PrivateKeywordSerializer(obj, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            instance = serializer.save()
            # Nếu nội dung thay đổi, reset suggestion link về null (1 write thêm)
            if reset_suggestion:
                instance.suggestion = None
                instance.save(update_fields=['suggestion'])
            
            from ..services.glossary_service import async_manage_user_glossaries
            async_manage_user_glossaries(request.user)
            
            return Response(PrivateKeywordSerializer(instance).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        obj = self._get_object(pk, request.user)
        if not obj:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        user = obj.user
        obj.delete()
        
        from ..services.glossary_service import async_manage_user_glossaries
        async_manage_user_glossaries(user)
        
        return Response(status=status.HTTP_204_NO_CONTENT)


class PrivateKeywordSuggestView(APIView):
    """Submit selected private keywords as suggestions to the common library."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'error': 'No keyword IDs provided.'}, status=status.HTTP_400_BAD_REQUEST)

        private_keywords = PrivateKeyword.objects.select_related('suggestion').filter(
            pk__in=ids, user=request.user
        )
        if not private_keywords.exists():
            return Response({'error': 'No matching private keywords found.'}, status=status.HTTP_404_NOT_FOUND)

        created = []
        skipped_pending = []
        skipped_approved = []

        for kw in private_keywords:
            # Skip nếu đang pending hoặc đã approved
            if kw.suggestion_id:
                current_status = kw.suggestion.status
                if current_status == 'pending':
                    skipped_pending.append(kw.id)
                    continue
                if current_status == 'approved':
                    skipped_approved.append(kw.id)
                    continue
                # Nếu rejected → cho phép suggest lại (tạo suggestion mới)

            suggestion = KeywordSuggestion.objects.create(
                user=request.user,
                japanese=kw.japanese,
                english=kw.english,
                vietnamese=kw.vietnamese,
                chinese_traditional=kw.chinese_traditional,
                chinese_simplified=kw.chinese_simplified,
                thai=kw.thai,
                bengali=kw.bengali,
                hindi=kw.hindi,
                indonesian=kw.indonesian,
                oriya=kw.oriya,
                status='pending',
                suggestion_count=1,
                frequency_percentage=0.0,
            )
            # Gắn suggestion vào private keyword để track trạng thái
            kw.suggestion = suggestion
            kw.save(update_fields=['suggestion'])
            created.append(suggestion.id)

        auto_approved = []
        if created:
            auto_approved = _try_auto_approve_on_threshold()

        messages = []
        if created:
            messages.append(f'{len(created)} keyword(s) submitted for review.')
        if auto_approved:
            messages.append(f'{len(auto_approved)} keyword(s) auto-added to the library (threshold reached).')
        if skipped_pending:
            messages.append(f'{len(skipped_pending)} keyword(s) already pending review.')
        if skipped_approved:
            messages.append(f'{len(skipped_approved)} keyword(s) already in the common library.')

        return Response({
            'message': ' '.join(messages) or 'No action taken.',
            'suggested_ids': created,
            'auto_approved_ids': auto_approved,
            'skipped_pending': skipped_pending,
            'skipped_approved': skipped_approved,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
