import { useState, useEffect } from "react";
import translationService from "../../services/translationService";
import { toast } from "react-toastify";
import { buttonStyles } from "../../styles/buttonStyles";

const FileUploadContainer = ({
  onFileUpload,
  children,
  acceptedFormats = ["pdf", "docx", "xlsx", "xls", "pptx", "ppt"],
  enableDragDrop = true,
  className = "",
}) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [tempFileData, setTempFileData] = useState(null);

  useEffect(() => {
    if (uploadProgress === 100 && tempFileData) {
      const fileData = {
        uri: tempFileData.publicUrl,
        fileType: tempFileData.fileType,
        docxUrl: tempFileData.docxUrl,
        originalFileName: tempFileData.originalFileName,
      };
      setFile(fileData);
      setTempFileData(null);

      // Notify parent component
      if (onFileUpload) {
        onFileUpload(fileData);
      }
    }
  }, [uploadProgress, tempFileData, onFileUpload]);

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length > 0) {
      uploadFile(selectedFiles[0]);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length > 0) {
      uploadFile(droppedFiles[0]);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const uploadFile = async (fileToUpload) => {
    const ext = fileToUpload.name.split(".").pop()?.toLowerCase();

    if (!ext || !acceptedFormats.includes(ext)) {
      toast.error(`Only ${acceptedFormats.map((f) => f.toUpperCase()).join(", ")} are supported.`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const fakeProgressInterval = setInterval(() => {
        setUploadProgress((prevProgress) => {
          if (prevProgress < 95) {
            return prevProgress + 5;
          }
          return prevProgress;
        });
      }, 500);

      const formData = new FormData();
      formData.append("file", fileToUpload);

      const response = await translationService.uploadToS3(formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const { publicUrl, docxUrl, conversionError } = response.data;
      clearInterval(fakeProgressInterval);
      setUploadProgress(100);

      // Check if PDF is editable (contains text, not scanned)
      // NOTE: To disable PDF validation, set PDF_VALIDATION_ENABLED=false in backend .env
      // or comment out this entire block
      if (ext === "pdf") {
        const checkResponse = await translationService.checkPdfEditable({
          file_url: publicUrl,
        });

        if (!checkResponse.data.is_editable) {
          toast.info("Your PDF will be translated by OCR", { autoClose: 5000 });
        }
      }

      if (ext === "pdf" && docxUrl) {
        toast.success("Your PDF was converted to DOCX to improve translation quality.", { autoClose: 4000 });
      }

      if (conversionError) {
        toast.warning(
          "Your PDF was uploaded but could not be converted to DOCX. Translation results may be suboptimal. Details: " + conversionError,
          { autoClose: 6000 }
        );
      }

      setTempFileData({
        publicUrl,
        fileType: ext,
        docxUrl: docxUrl,
        originalFileName: fileToUpload.name,
      });

      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Upload failed: " + (error.response?.data?.error || error.message));
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setUploadProgress(0);
    // Notify parent component
    if (onFileUpload) {
      onFileUpload(null);
    }
  };

  return (
    <div
      className={`w-full h-full flex flex-col bg-white flex-1 items-center justify-center rounded-2xl relative ${className}`}
    >
      {/* Header section - will be provided by children */}
      {children && children.header}

      <div className="flex flex-col flex-1 h-full w-full rounded-b-2xl items-center justify-center">
        <div
          className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 h-3/5 w-[90%] bg-gray-50 rounded-lg flex flex-col items-center justify-center text-center border border-gray-300 border-dashed hover:border-blue-400 hover:bg-gray-100 transition-all duration-300 p-8"
          onDrop={enableDragDrop && !file ? handleDrop : undefined}
          onDragOver={enableDragDrop && !file ? handleDragOver : undefined}
          style={{ cursor: !file && enableDragDrop ? "pointer" : "default" }}
        >
          {uploading ? (
            <div className="w-full flex flex-col items-center justify-center">
              <div className="relative w-36 h-36 mb-6">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#E9F9F9"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="10"
                    strokeDasharray={`${uploadProgress * 2.51} 251`}
                    strokeDashoffset="0"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-medium text-gray-700">
                    {uploadProgress}%
                  </span>
                </div>
              </div>

              <p className="text-blue-600 font-bold text-lg mb-4">
                {uploadProgress}% to complete
              </p>

              <div className="w-full max-w-md h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : !file ? (
            <>
              <div className="mb-4">
                <img
                  src="/assets/upload.svg"
                  alt="Upload"
                  className="w-[60px] h-[60px] sm:w-[70px] sm:h-[70px] md:w-[80px] md:h-[80px] lg:w-[90px] lg:h-[90px]"
                />
              </div>
              <p className="text-gray-700 font-medium text-base sm:text-lg lg:text-xl mb-2">
                Choose a file or Drag and drop it here
              </p>
              <p className="text-gray-500 text-sm mb-6">
                {acceptedFormats.map((f) => f.toUpperCase()).join(", ")}
              </p>
              <label htmlFor="fileInput" className={buttonStyles.browse}>
                Browse
              </label>
              <input
                type="file"
                id="fileInput"
                className="hidden"
                accept={`.${acceptedFormats.join(", .")}`}
                onChange={handleFileChange}
              />
            </>
          ) : (
            // Content when file is uploaded - provided by children
            <div className="flex flex-col items-center justify-center space-y-6 w-full">
              {children && children.fileContent ? (
                children.fileContent(file, handleRemoveFile)
              ) : (
                <div className="text-center">
                  <p className="text-gray-700 font-medium">
                    {file.originalFileName}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {file.fileType.toUpperCase()} File
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUploadContainer;
