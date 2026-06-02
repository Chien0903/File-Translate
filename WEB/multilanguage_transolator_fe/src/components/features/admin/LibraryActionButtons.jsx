import React, { useState } from "react";
import {
  FaFileExport,
  FaCloudUploadAlt,
  FaInfoCircle,
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
  onShowGcsInfo,
  onOpenSuggestionQueue,
  onOpenQueueThreshold,
}) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleExport = () => {
    const exportData = keywords.map((keyword) => ({
      japanese: keyword.japanese || "",
      english: keyword.english || "",
      vietnamese: keyword.vietnamese || "",
      chinese_traditional: keyword.chinese_traditional || "",
      chinese_simplified: keyword.chinese_simplified || "",
      bengali: keyword.bengali || "",
      indonesian: keyword.indonesian || "",
      hindi: keyword.hindi || "",
      oriya: keyword.oriya || "",
      thai: keyword.thai || "",
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
      {/* Left side - Export Buttons */}
      <div className="flex flex-wrap items-center gap-[1rem]">
        <button
          className="flex items-center justify-center px-4 py-2 bg-[#359740] text-white rounded-full hover:bg-[#2e8237] min-w-[130px]"
          onClick={handleExport}
        >
          <FaFileExport className="mr-2" /> Export
        </button>

        {(role === "Library Keeper" || role === "Admin") && (
          <button
            className={`flex items-center justify-center px-4 py-2 text-white rounded-full min-w-[150px] transition-colors ${
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
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Uploading...
              </>
            ) : (
              <>
                <FaCloudUploadAlt className="mr-2" /> Upload Library
              </>
            )}
          </button>
        )}

        {(role === "Library Keeper" || role === "Admin") && (
          <button
            className="flex items-center justify-center px-3 py-2 bg-gray-500 text-white rounded-full hover:bg-gray-600 transition-colors"
            onClick={onShowGcsInfo}
            title="Show GCS Status Info"
          >
            <FaInfoCircle />
          </button>
        )}

        {(role === "Library Keeper" || role === "Admin") &&
          onOpenQueueThreshold && (
            <button
              type="button"
              className="flex items-center justify-center px-4 py-2 min-w-[140px] rounded-full border-2 border-[#004098] text-[#004098] bg-white hover:bg-[#E6F1F8] transition-colors shadow-sm"
              onClick={onOpenQueueThreshold}
              title="Minimum distinct users who must suggest the same content before it appears in the queue"
            >
              <FaSlidersH className="mr-2 shrink-0" /> Queue threshold
            </button>
          )}

        {(role === "Library Keeper" || role === "Admin") &&
          onOpenSuggestionQueue && (
            <button
              type="button"
              className="flex items-center justify-center px-4 py-2 min-w-[168px] rounded-full bg-[#004098] text-white hover:bg-[#003875] transition-colors shadow-sm"
              onClick={onOpenSuggestionQueue}
              title="Search pending suggestions by user name"
            >
              <FaInbox className="mr-2 shrink-0" /> Suggestion search
            </button>
          )}
      </div>

    </>
  );
};

export default LibraryActionButtons;
