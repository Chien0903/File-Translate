import React, { useState } from "react";
import {
  FaFileExport,
  FaCloudUploadAlt,
  FaSlidersH,
  FaInbox,
} from "react-icons/fa";
import { FiAlertCircle, FiCheck, FiX } from "react-icons/fi";
import * as XLSX from "xlsx";
import keywordService from "../../../services/keywordService";
import { toast } from "react-toastify";

const LibraryActionButtons = ({
  keywords,
  role,
  gcsStatus,
  onRefreshKeywords,
  onOpenSuggestionQueue,
  onOpenQueueThreshold,
}) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleExport = () => {
    const exportData = keywords.map((keyword) => ({
      ...(keyword.translations || {}),
      date_modified: keyword.date_modified || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Keywords");
    XLSX.writeFile(workbook, "keywords.xlsx");
  };

  const handleUploadToGCS = async () => {
    if (!gcsStatus?.can_upload) {
      toast.error("No approved keywords available to upload!", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
      return;
    }

    if (!gcsStatus?.user_permissions?.can_upload) {
      toast.error("Admin or Library Keeper permission required", {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiAlertCircle />,
      });
      return;
    }

    setIsUploading(true);
    try {
      // Upload keywords to GCS and update glossaries
      const uploadResponse = await keywordService.uploadToGCS();
      const result = uploadResponse.data;

      // Tạo message chi tiết về glossary updates
      let successMessage = `Successfully created CSV file and uploaded ${result.details.approved_keywords_count} keywords to GCS!`;

      if (result.details.glossary_updates) {
        const { successful, failed } = result.details.glossary_updates;
        successMessage += ` Updated ${successful} glossaries.`;

        if (failed > 0) {
          successMessage += ` (${failed} glossary updates failed)`;
        }
      }

      toast.success(successMessage, {
        style: { backgroundColor: "green", color: "white" },
        icon: <FiCheck />,
        autoClose: 5000,
      });

      // Log glossary details để debug
      if (result.details.glossary_updates?.errors?.length > 0) {
        console.warn(
          "Glossary update errors:",
          result.details.glossary_updates.errors
        );
      }

      // Refresh GCS status
      const statusResponse = await keywordService.getGCSStatus();
      // Call parent callback to update GCS status
      if (onRefreshKeywords) {
        onRefreshKeywords(statusResponse.data);
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || "Failed to upload keywords to GCS!";
      toast.error(errorMsg, {
        style: { backgroundColor: "red", color: "white" },
        icon: <FiX />,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      {/* Action buttons */}
      <button
        className="flex items-center gap-1.5 px-4 py-2 bg-[#359740] text-white rounded-full text-sm font-medium hover:bg-[#2e8237] transition-colors shadow-sm"
        onClick={handleExport}
        title="Export approved keywords to Excel"
      >
        <FaFileExport size={14} />
        Export
      </button>

      {(role === "Library Keeper" || role === "Admin") && (
        <button
          className={`flex items-center gap-1.5 px-4 py-2 text-white rounded-full text-sm font-medium transition-colors shadow-sm ${
            isUploading
              ? "bg-gray-400 cursor-not-allowed"
              : gcsStatus?.can_upload &&
                gcsStatus?.user_permissions?.can_upload
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-gray-400 cursor-not-allowed"
          }`}
          onClick={handleUploadToGCS}
          disabled={
            isUploading ||
            !gcsStatus?.can_upload ||
            !gcsStatus?.user_permissions?.can_upload
          }
          title={
            !gcsStatus?.user_permissions?.can_upload
              ? "Admin or Library Keeper permission required"
              : !gcsStatus?.can_upload
              ? "No approved keywords to upload"
              : "Upload approved keywords to Google Cloud Storage"
          }
        >
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
              Uploading...
            </>
          ) : (
            <>
              <FaCloudUploadAlt size={14} />
              Upload Library
            </>
          )}
        </button>
      )}

      {(role === "Library Keeper" || role === "Admin") &&
        onOpenQueueThreshold && (
          <button
            type="button"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-indigo-700 text-indigo-700 bg-white text-sm font-medium hover:bg-indigo-50 transition-colors shadow-sm"
            onClick={onOpenQueueThreshold}
            title="Minimum distinct users who must suggest the same content before it appears in the queue"
          >
            <FaSlidersH size={14} className="shrink-0" />
            Queue threshold
          </button>
        )}

      {(role === "Library Keeper" || role === "Admin") &&
        onOpenSuggestionQueue && (
          <button
            type="button"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-indigo-700 text-white text-sm font-medium hover:bg-[#003276] transition-colors shadow-sm"
            onClick={onOpenSuggestionQueue}
            title="Search pending suggestions by user name"
          >
            <FaInbox size={14} className="shrink-0" />
            Suggestion search
          </button>
        )}
    </>
  );
};

export default LibraryActionButtons;
