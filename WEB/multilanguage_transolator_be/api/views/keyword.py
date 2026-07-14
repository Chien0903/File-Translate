from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, BasePermission
import hashlib
import re
import unicodedata
from itertools import combinations

from ..models.keyword import KeywordSuggestion, PrivateKeyword, LibraryQueueSettings
from ..models.notification import Notification
from ..serializers.keyword import KeywordSuggestionSerializer, PrivateKeywordSerializer
from django.contrib.auth import get_user_model
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


# Chỉ cho phép Admin/Library Keeper (hoặc staff) truy cập view.
class IsAdminOrLibraryKeeper(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            (request.user.is_staff or request.user.role in ['Admin', 'Library Keeper'])
        )


def _check_admin_or_keeper(user):
    return user.is_staff or getattr(user, 'role', '') in ['Admin', 'Library Keeper']


def _get_active_language_codes():
    """Return list of ISO codes for all languages in the system."""
    from ..models.language import Language
    return list(Language.objects.all().values_list('code', flat=True))


PRIVATE_DUP_PLACEHOLDERS = {"", "-", "—", "–", "null", "none", ".."}


def _normalize_val(value):
    s = (value or "").strip().lower()
    return "" if s in PRIVATE_DUP_PLACEHOLDERS else s


def _normalize_queue_text(value):
    if value is None:
        return ''
    s = str(value).strip()
    if not s:
        return ''
    s = unicodedata.normalize('NFKC', s)
    for z in ('​', '‌', '‍', '﻿'):
        s = s.replace(z, '')
    for ch in ('’', '‘', 'ʹ', 'ʼ', '＇'):
        s = s.replace(ch, "'")
    s = re.sub(r'\s+', ' ', s)
    return s.lower()


def _build_pair_keys(translations: dict):
    """Build all (code_a, code_b, val_a, val_b) pairs from a translations dict."""
    codes = [c for c in _get_active_language_codes()]
    normalized = {c: _normalize_val(translations.get(c, "")) for c in codes}
    keys = set()
    for ca, cb in combinations(codes, 2):
        va, vb = normalized.get(ca, ""), normalized.get(cb, "")
        if va and vb:
            keys.add((ca, cb, va, vb))
    return keys


def _find_private_pair_conflict(user, candidate_translations, exclude_private_id=None):
    candidate_pairs = _build_pair_keys(candidate_translations)
    if not candidate_pairs:
        return None
    queryset = PrivateKeyword.objects.filter(user=user)
    if exclude_private_id is not None:
        queryset = queryset.exclude(id=exclude_private_id)
    for row in queryset.only('id', 'translations'):
        row_pairs = _build_pair_keys(row.translations or {})
        if candidate_pairs.intersection(row_pairs):
            return row.id
    return None


def _find_thk_pair_conflict(candidate_translations, exclude_suggestion_id=None):
    candidate_pairs = _build_pair_keys(candidate_translations)
    if not candidate_pairs:
        return None
    queryset = KeywordSuggestion.objects.filter(status='approved')
    if exclude_suggestion_id is not None:
        queryset = queryset.exclude(id=exclude_suggestion_id)
    for row in queryset.only('id', 'translations'):
        row_pairs = _build_pair_keys(row.translations or {})
        if candidate_pairs.intersection(row_pairs):
            return row.id
    return None


def _check_keyword_duplicates(keyword, approved_rows=None):
    """Check if any single non-empty translation value matches an approved record.

    `approved_rows` lets callers that check many suggestions in one request
    (e.g. the queue list) pass a single pre-fetched list instead of re-querying
    the approved set for every row.
    """
    duplicates = []
    t = keyword.translations or {}
    if approved_rows is None:
        approved_rows = KeywordSuggestion.objects.filter(status='approved').only('id', 'translations')
    for code, value in t.items():
        normalized = str(value or "").strip()
        if not normalized:
            continue
        conflicts = [
            obj.id for obj in approved_rows
            if str((obj.translations or {}).get(code, "")).strip().lower() == normalized.lower()
        ]
        if conflicts:
            duplicates.append({'field': code, 'value': normalized, 'conflict_ids': conflicts[:5]})
    return duplicates


def _content_signature(keyword):
    """Hash of all non-empty translations for duplicate grouping."""
    t = keyword.translations or {}
    parts = [f"{code}:{val.strip().lower()}" for code, val in t.items() if val and str(val).strip()]
    if not parts:
        return ""
    return hashlib.sha256("|".join(sorted(parts)).encode("utf-8")).hexdigest()


def _reject_other_pending_same_content(approved_suggestion):
    sig = _content_signature(approved_suggestion)
    if not sig:
        return
    for s in KeywordSuggestion.objects.filter(status='pending').exclude(id=approved_suggestion.id):
        if _content_signature(s) == sig:
            s.status = 'rejected'
            s.save(update_fields=['status', 'updated_at'])


def _notify_threshold_reached(suggestion):
    """Notify Library Keepers/Admins that a suggestion has reached the review threshold."""
    User = get_user_model()
    keepers = User.objects.filter(Q(is_staff=True) | Q(role__in=['Admin', 'Library Keeper']))
    if not keepers.exists():
        return
    # Avoid the JSONField "contains" lookup: it isn't supported on SQLite
    # (raises NotSupportedError), only on backends like PostgreSQL. Check
    # in Python instead so this works on every configured database backend.
    already_notified = any(
        isinstance(details, list) and any(
            isinstance(item, dict) and item.get("suggestion_id") == suggestion.id
            for item in details
        )
        for details in Notification.objects.filter(
            title=THRESHOLD_REACHED_TITLE
        ).values_list('keyword_details', flat=True)
    )
    if already_notified:
        return
    for keeper in keepers:
        Notification.objects.create(
            user=keeper,
            title=THRESHOLD_REACHED_TITLE,
            message=(
                "A keyword suggestion has reached the configured threshold and is "
                "ready for your review in the Suggestion Queue."
            ),
            details=True,
            keyword_details=[{
                "suggestion_id": suggestion.id,
                "translations": suggestion.translations,
            }],
        )


def _group_pending_by_threshold(pending):
    """
    Group a list of pending KeywordSuggestion rows by matching (language pair,
    normalized value) across every pair of active languages, keeping only the
    groups whose number of distinct suggesters reaches the configured
    min_suggesters_for_queue threshold.tóm 

    Returns {representative_suggestion_id: group_list}, where the
    representative is the lowest-id suggestion in that group.
    """
    if not pending:
        return {}

    settings = LibraryQueueSettings.load()
    min_n = settings.min_suggesters_for_queue
    codes = _get_active_language_codes()
    reps = {}

    for ca, cb in combinations(codes, 2):
        groups = {}
        for s in pending:
            t = s.translations or {}
            va = _normalize_queue_text(t.get(ca, ""))
            vb = _normalize_queue_text(t.get(cb, ""))
            if not va or not vb:
                continue
            gkey = f"{ca}|{cb}|{va}|{vb}"
            groups.setdefault(gkey, []).append(s)

        for gkey, group in groups.items():
            tokens = set()
            for s in group:
                tokens.add(f"u:{s.user_id}" if s.user_id else f"row:{s.id}")
            if len(tokens) < min_n:
                continue

            group.sort(key=lambda x: x.id)
            rep = group[0]
            if rep.status != 'pending':
                continue

            reps[rep.id] = group

    return reps


def _try_auto_approve_on_threshold():
    """
    When enough distinct users suggest the same translation pair (>= min_suggesters_for_queue),
    notify Library Keepers/Admins to review the suggestion rather than auto-approving.
    Returns a list of suggestion IDs that reached the threshold this call.
    """
    pending = list(KeywordSuggestion.objects.filter(status='pending').select_related('user'))
    if not pending:
        return []

    reps = _group_pending_by_threshold(pending)
    notified_ids = set()

    for rep_id, group in reps.items():
        rep = group[0]
        _notify_threshold_reached(rep)
        notified_ids.add(rep.id)

    return list(notified_ids)


# ======= Keyword CRUD Views =======

# Cho phép sửa nội dung một đề xuất từ khoá khi còn đang "pending".
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
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Duyệt một đề xuất vào thư viện chung; nếu trùng với keyword đã duyệt thì trả về
# xung đột (409) để client chọn cách xử lý qua `duplicate_resolution`.
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
            return Response({'error': f'Failed to check duplicates: {str(e)}'}, status=500)

        if duplicates:
            if resolution is None:
                first_id = duplicates[0]['conflict_ids'][0]
                try:
                    existing = KeywordSuggestion.objects.get(id=first_id, status='approved')
                except KeywordSuggestion.DoesNotExist:
                    return Response({'error': 'Conflict target not found'}, status=500)
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
                existing.translations = suggestion.translations
                existing.save(update_fields=['translations', 'updated_at'])

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
        all_user_ids = User.objects.values_list('id', flat=True)
        keyword_details = [{"translations": suggestion.translations}]
        Notification.objects.bulk_create(
            [
                Notification(
                    user_id=uid,
                    title="New Keyword Added",
                    message="A new keyword has been added to the library.",
                    details=True,
                    keyword_details=keyword_details,
                )
                for uid in all_user_ids
            ],
            batch_size=500,
        )
        return Response({"message": "Suggestion approved!"})


# Xoá một đề xuất từ khoá (chủ sở hữu hoặc Admin/Library Keeper mới được xoá).
@method_decorator(csrf_exempt, name='dispatch')
class DeleteSuggestionView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        try:
            suggestion = KeywordSuggestion.objects.get(id=pk)
        except KeywordSuggestion.DoesNotExist:
            return Response({"detail": "Suggestion not found"}, status=status.HTTP_404_NOT_FOUND)

        user_is_owner = request.user == suggestion.user
        if not (user_is_owner or _check_admin_or_keeper(request.user)):
            return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

        was_approved = suggestion.status == 'approved'
        suggestion.delete()
        if was_approved:
            async_manage_common_glossaries()
        return Response({"message": "Suggestion deleted successfully"}, status=status.HTTP_204_NO_CONTENT)


# Cập nhật nội dung một KeywordSuggestion đã tồn tại (kiểm tra trùng lặp nếu đã duyệt).
class UpdateKeywordView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        try:
            keyword = KeywordSuggestion.objects.get(id=pk)
        except KeywordSuggestion.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if keyword.status == 'approved':
            new_translations = request.data.get('translations', keyword.translations or {})
            conflict_id = _find_thk_pair_conflict(
                candidate_translations=new_translations,
                exclude_suggestion_id=keyword.id,
            )
            if conflict_id:
                return Response(
                    {"detail": f"Duplicate detected in Common Library (id={conflict_id})."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = KeywordSuggestionSerializer(keyword, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            if keyword.status == 'approved':
                async_manage_common_glossaries()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ======= Keyword List/Create =======

# Liệt kê (lọc/tìm kiếm/phân trang) và tạo mới đề xuất từ khoá (mặc định 'pending').
class KeywordSuggestionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            queryset = KeywordSuggestion.objects.all().order_by('-created_at')

            status_filter = request.GET.get('status')
            if status_filter:
                queryset = queryset.filter(status=status_filter)

            search = request.GET.get('search', '').strip()
            if search:
                lang_codes = _get_active_language_codes()
                q = Q()
                for code in lang_codes:
                    q |= Q(**{f'translations__{code}__icontains': search})
                queryset = queryset.filter(q)

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
            serializer = KeywordSuggestionSerializer(queryset[start:start + page_size], many=True)
            return Response({
                'results': serializer.data,
                'total': total,
                'page': page,
                'page_size': page_size,
                'total_pages': max(1, (total + page_size - 1) // page_size),
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    def post(self, request):
        try:
            translations = request.data.get('translations', {})
            if not translations or not any(v.strip() for v in translations.values() if isinstance(v, str)):
                return Response({'error': 'At least one translation is required.'}, status=400)

            payload = {
                'translations': translations,
                'status': 'pending',
            }
            serializer = KeywordSuggestionSerializer(data=payload, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                threshold_notified = _try_auto_approve_on_threshold()
                data = serializer.data
                if threshold_notified:
                    data['threshold_notified_ids'] = threshold_notified
                return Response(data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=400)
        except Exception as e:
            return Response({'error': str(e)}, status=500)


# ======= GCS Upload Endpoints =======

# Xuất các keyword đã duyệt thành CSV, tải lên GCS và cập nhật lại glossary dịch thuật.
class UploadKeywordsToGCSView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        csv_file_path = None
        try:
            if not _check_admin_or_keeper(request.user):
                return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

            csv_file_path = create_glossary_csv_file()
            if not csv_file_path:
                return Response({'error': 'No approved keywords found to upload'}, status=400)

            gcs_url = upload_csv_to_gcs(csv_file_path)
            results, errors = manage_all_glossaries()
            approved_count = KeywordSuggestion.objects.filter(status='approved').count()

            return Response({
                'message': 'Keywords extracted, uploaded to GCS and glossaries updated.',
                'details': {
                    'gcs_url': gcs_url,
                    'approved_keywords_count': approved_count,
                    'glossary_updates': {
                        'successful': len(results),
                        'failed': len(errors),
                        'errors': errors or None,
                    },
                },
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)
        finally:
            if csv_file_path and os.path.exists(csv_file_path):
                try:
                    os.unlink(csv_file_path)
                except Exception:
                    pass


THRESHOLD_REACHED_TITLE = "Keyword Ready for Review"


# Trả về thống kê keyword và trạng thái file glossary trên GCS.
class GCSUploadStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            total = KeywordSuggestion.objects.count()
            approved = KeywordSuggestion.objects.filter(status='approved').count()
            pending = KeywordSuggestion.objects.filter(status='pending').count()

            bucket_name = os.getenv("BUCKET_NAME", "company-buckets")
            gcs_info = None
            try:
                sc = storage.Client()
                blob = sc.bucket(bucket_name).blob("glossary_term.csv")
                if blob.exists():
                    blob.reload()
                    gcs_info = {'exists': True, 'size': blob.size, 'updated': blob.updated.isoformat() if blob.updated else None}
                else:
                    gcs_info = {'exists': False}
            except Exception as e:
                gcs_info = {'error': str(e)}

            return Response({
                'keywords_stats': {'total': total, 'approved': approved, 'pending': pending},
                'gcs_file': gcs_info,
                'can_upload': approved > 0,
                'user_permissions': {'can_upload': _check_admin_or_keeper(request.user)},
            })
        except Exception as e:
            return Response({'error': str(e)}, status=500)


# Đọc/ghi ngưỡng `min_suggesters_for_queue` (số người đề xuất trùng cần để vào hàng chờ duyệt).
class SuggestionQueueSettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings = LibraryQueueSettings.load()
        return Response({'min_suggesters_for_queue': settings.min_suggesters_for_queue})

    def patch(self, request):
        settings = LibraryQueueSettings.load()
        if not _check_admin_or_keeper(request.user):
            return Response({'error': 'Permission denied.'}, status=403)
        val = request.data.get('min_suggesters_for_queue')
        if val is None:
            return Response({'error': 'min_suggesters_for_queue is required'}, status=400)
        try:
            v = int(val)
            if v < 2 or v > 9999:
                raise ValueError()
        except (TypeError, ValueError):
            return Response({'error': 'min_suggesters_for_queue must be between 2 and 9999'}, status=400)
        settings.min_suggesters_for_queue = v
        settings.save()
        threshold_notified_ids = _try_auto_approve_on_threshold()
        return Response({
            'min_suggesters_for_queue': settings.min_suggesters_for_queue,
            'threshold_notified_ids': threshold_notified_ids,
            'threshold_notified_count': len(threshold_notified_ids),
        })


# Danh sách đề xuất đã đạt ngưỡng số người đề xuất, chờ Admin/Library Keeper duyệt.
class SuggestionQueueListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _check_admin_or_keeper(request.user):
            return Response({'error': 'Permission denied.'}, status=403)

        # Only show suggestions whose group of matching proposals has reached
        # the configured min_suggesters_for_queue threshold — suggestions still
        # accumulating suggesters are not shown here yet.
        all_pending = list(KeywordSuggestion.objects.filter(status='pending').select_related('user'))
        reps_map = _group_pending_by_threshold(all_pending)
        threshold_reached_ids = set(reps_map.keys())

        search = (request.GET.get('search') or '').strip()
        base_qs = KeywordSuggestion.objects.filter(
            status='pending', id__in=threshold_reached_ids
        ).select_related('user')

        if search:
            tokens = [t.strip() for t in search.split(',') if t.strip()]
            if tokens:
                def _user_q(token):
                    return (
                        Q(user__first_name__icontains=token)
                        | Q(user__last_name__icontains=token)
                        | Q(user__email__icontains=token)
                    )

                user_matched_ids = set()
                for token in tokens:
                    user_matched_ids.update(
                        base_qs.filter(_user_q(token)).values_list('id', flat=True)
                    )

                lang_codes = _get_active_language_codes()
                content_q = Q()
                for token in tokens:
                    token_q = Q()
                    for code in lang_codes:
                        token_q |= Q(**{f'translations__{code}__icontains': token})
                    content_q |= token_q
                content_matched_ids = set(
                    base_qs.filter(content_q).values_list('id', flat=True)
                )

                all_ids = user_matched_ids | content_matched_ids
                queryset = KeywordSuggestion.objects.filter(
                    status='pending', id__in=all_ids
                ).select_related('user').order_by('-created_at')
            else:
                queryset = base_qs.order_by('-created_at')
        else:
            queryset = base_qs.order_by('-created_at')

        total = queryset.count()
        try:
            page_size = max(1, min(int(request.GET.get('page_size', 8)), 50))
        except (TypeError, ValueError):
            page_size = 8
        try:
            page = max(1, int(request.GET.get('page', 1)))
        except (TypeError, ValueError):
            page = 1
        total_pages = max(1, (total + page_size - 1) // page_size)
        page = min(page, total_pages)

        approved_rows = list(KeywordSuggestion.objects.filter(status='approved').only('id', 'translations'))

        start = (page - 1) * page_size
        result = []
        for s in queryset[start:start + page_size]:
            user_display = ''
            if s.user:
                full = f"{s.user.first_name or ''} {s.user.last_name or ''}".strip()
                user_display = full or s.user.email

            # All distinct suggesters behind this representative row (the group
            # of matching pending proposals that pushed it past the threshold),
            # not just the earliest one that ended up as `s`.
            suggesters = []
            seen_user_ids = set()
            for member in reps_map.get(s.id, [s]):
                key = member.user_id if member.user_id else f"row:{member.id}"
                if key in seen_user_ids:
                    continue
                seen_user_ids.add(key)
                if member.user:
                    full_name = f"{member.user.first_name or ''} {member.user.last_name or ''}".strip()
                    name = full_name or member.user.email
                    email = member.user.email
                else:
                    name = 'Unknown'
                    email = None
                suggesters.append({'user_id': member.user_id, 'name': name, 'email': email})

            duplicates = _check_keyword_duplicates(s, approved_rows=approved_rows)

            result.append({
                'id': s.id,
                'user_id': s.user_id,
                'user_display': user_display,
                'user_email': s.user.email if s.user else None,
                'translations': s.translations or {},
                'status': s.status,
                'created_at': s.created_at.isoformat() if s.created_at else None,
                'suggesters': suggesters,
                'suggester_count': len(suggesters),
                'is_duplicate': bool(duplicates),
                'duplicates': duplicates,
            })

        return Response({'suggestions': result, 'total': total, 'page': page, 'page_size': page_size, 'total_pages': total_pages})


# ===== Private Library Views =====

# Liệt kê và tạo từ khoá trong Thư viện riêng (Private Library) của user hiện tại.
class PrivateKeywordListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        keywords = PrivateKeyword.objects.filter(user=request.user).select_related('user', 'suggestion')
        return Response(PrivateKeywordSerializer(keywords, many=True).data)

    def post(self, request):
        translations = request.data.get('translations', {})
        has_content = any(str(v).strip() for v in translations.values() if v)
        if not has_content:
            return Response({'error': 'At least one language field is required.'}, status=400)

        conflict_id = _find_private_pair_conflict(user=request.user, candidate_translations=translations)
        if conflict_id:
            return Response(
                {"error": f"Duplicate detected in your private library (conflict id={conflict_id})."},
                status=400,
            )
        serializer = PrivateKeywordSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(user=request.user)
            from ..services.glossary_service import async_manage_user_glossaries
            async_manage_user_glossaries(request.user)
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)


# Xem/sửa/xoá một từ khoá riêng tư cụ thể, chỉ chủ sở hữu mới thao tác được.
class PrivateKeywordDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_object(self, pk, user):
        try:
            return PrivateKeyword.objects.get(pk=pk, user=user)
        except PrivateKeyword.DoesNotExist:
            return None

    def get(self, request, pk):
        obj = self._get_object(pk, request.user)
        if not obj:
            return Response({'error': 'Not found.'}, status=404)
        return Response(PrivateKeywordSerializer(obj).data)

    def put(self, request, pk):
        obj = self._get_object(pk, request.user)
        if not obj:
            return Response({'error': 'Not found.'}, status=404)

        new_translations = request.data.get('translations', obj.translations or {})
        content_changed = new_translations != (obj.translations or {})
        reset_suggestion = content_changed and obj.suggestion_id is not None

        conflict_id = _find_private_pair_conflict(
            user=request.user,
            candidate_translations=new_translations,
            exclude_private_id=obj.id,
        )
        if conflict_id:
            return Response(
                {"error": f"Duplicate detected in your private library (conflict id={conflict_id})."},
                status=400,
            )

        serializer = PrivateKeywordSerializer(obj, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            instance = serializer.save()
            if reset_suggestion:
                instance.suggestion = None
                instance.save(update_fields=['suggestion'])
            from ..services.glossary_service import async_manage_user_glossaries
            async_manage_user_glossaries(request.user)
            return Response(PrivateKeywordSerializer(instance).data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        obj = self._get_object(pk, request.user)
        if not obj:
            return Response({'error': 'Not found.'}, status=404)
        user = obj.user
        obj.delete()
        from ..services.glossary_service import async_manage_user_glossaries
        async_manage_user_glossaries(user)
        return Response(status=204)


# Đẩy các từ khoá riêng tư đã chọn lên thành đề xuất công khai ('pending').
class PrivateKeywordSuggestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({'error': 'No keyword IDs provided.'}, status=400)

        private_keywords = PrivateKeyword.objects.select_related('suggestion').filter(pk__in=ids, user=request.user)
        if not private_keywords.exists():
            return Response({'error': 'No matching private keywords found.'}, status=404)

        created, skipped_pending, skipped_approved = [], [], []

        for kw in private_keywords:
            if kw.suggestion_id:
                s = kw.suggestion.status
                if s == 'pending':
                    skipped_pending.append(kw.id)
                    continue
                if s == 'approved':
                    skipped_approved.append(kw.id)
                    continue

            suggestion = KeywordSuggestion.objects.create(
                user=request.user,
                translations=kw.translations or {},
                status='pending',
            )
            kw.suggestion = suggestion
            kw.save(update_fields=['suggestion'])
            created.append(suggestion.id)

        threshold_notified = _try_auto_approve_on_threshold() if created else []

        messages = []
        if created:
            messages.append(f'{len(created)} keyword(s) submitted for review.')
        if threshold_notified:
            messages.append(f'{len(threshold_notified)} keyword(s) reached the threshold and sent to Library Keeper queue.')
        if skipped_pending:
            messages.append(f'{len(skipped_pending)} keyword(s) already pending review.')
        if skipped_approved:
            messages.append(f'{len(skipped_approved)} keyword(s) already in the common library.')

        return Response({
            'message': ' '.join(messages) or 'No action taken.',
            'suggested_ids': created,
            'threshold_notified_ids': threshold_notified,
            'skipped_pending': skipped_pending,
            'skipped_approved': skipped_approved,
        }, status=201 if created else 200)
