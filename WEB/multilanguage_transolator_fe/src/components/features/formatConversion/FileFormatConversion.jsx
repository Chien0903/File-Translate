import { useState } from "react";
import { Select } from "antd";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import translationService from "../../../services/translationService";
import { buttonStyles } from "../../../styles/buttonStyles";

const FileFormatConversion = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [inputFormat, setInputFormat] = useState("PDF");
  const [outputFormat, setOutputFormat] = useState("DOCX");
  const [converting, setConverting] = useState(false);

  const inputFormatOptions = [{ value: "PDF", label: "PDF" }];

  const outputFormatOptions = [
    { value: "DOCX", label: "DOCX" },
    { value: "XLSX", label: "XLSX" },
    { value: "PPTX", label: "PPTX" },
  ];

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
    const allowedFormats = ["pdf"];

    if (!ext || !allowedFormats.includes(ext)) {
      toast.error("Only PDF files are supported.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Fake progress for demo
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

      const { publicUrl } = response.data;
      clearInterval(fakeProgressInterval);
      setUploadProgress(100);

      setFile({
        uri: publicUrl,
        fileType: ext,
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
  };

  const handleConvertClick = async () => {
    if (!file) {
      toast.error("Please upload a file before converting.");
      return;
    }

    if (outputFormat === "PDF") {
      toast.error("Cannot convert PDF to PDF. Please select a different output format.");
      return;
    }

    setConverting(true);

    try {
      const payload = {
        file_url: file.uri,
        target_format: outputFormat.toLowerCase(),
        original_filename: file.originalFileName,
      };

      console.log("Converting file with payload:", payload);

      const response = await translationService.convertFile(payload);

      console.log("Conversion response:", response.data);

      if (response.data.success) {
        const convertedFile = {
          url: response.data.converted_file.url,
          name: response.data.converted_file.filename, // Tên file converted (ví dụ: document.docx)
          originalFileName: response.data.converted_file.original_filename, // ✅ Tên file gốc (ví dụ: document.pdf)
          fileType: response.data.converted_file.format.toLowerCase(),
        };

        toast.success(response.data.message || "Conversion successful!");

        // Navigate to conversion results page
        navigate("/conversion-results", {
          state: {
            originalFile: file,
            inputFormat: inputFormat,
            outputFormat: outputFormat,
            convertedFile: convertedFile,
          },
        });
      } else {
        throw new Error(response.data.error || "Conversion failed");
      }
    } catch (error) {
      console.error("Conversion error:", error);

      let errorMessage = "An error occurred during file conversion.";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error("Conversion failed: " + errorMessage, { autoClose: 6000 });
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white flex-1 items-center justify-center rounded-2xl relative">
      {/* Header section with format selectors */}
      <div className="w-full rounded-t-2xl p-4">
        <div className="flex flex-row justify-between w-full items-center">
          {/* Format Selectors */}
          <div className="flex flex-row items-center space-x-6">
            {/* Input Format Select */}
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-gray-700">From</label>
              <Select
                value={inputFormat}
                onChange={setInputFormat}
                options={inputFormatOptions}
                style={{ width: 120 }}
                className="h-10"
                disabled={true}
              />
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center pt-6">
              <div className="bg-blue-500 rounded-full p-2">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-white"
                >
                  <path
                    d="M13.5 4.5L21 12M21 12L13.5 19.5M21 12H3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Output Format Select */}
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-gray-700">To</label>
              <Select
                value={outputFormat}
                onChange={setOutputFormat}
                options={outputFormatOptions}
                style={{ width: 120 }}
                className="h-10"
              />
            </div>
          </div>

          {/* Remove File Button */}
          {file && (
            <div className="flex items-center">
              <button
                onClick={handleRemoveFile}
                className={`${buttonStyles.iconSecondary} ml-3`}
                title="Remove file"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 h-full w-full rounded-b-2xl items-center justify-center">
        {/* Upload/File Display area - keep the outer container */}
        <div
          className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 h-3/5 w-[90%] bg-[#F8F8F8] rounded-lg flex flex-col items-center justify-center text-center border border-gray-300 border-dashed p-4"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
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
                    stroke="#004098"
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

              <p className="text-[#004098] font-bold text-lg mb-4">
                {uploadProgress}% to complete
              </p>

              <div className="w-full max-w-md h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#004098] rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : !file ? (
            <>
              <div className="mb-2 sm:mb-4 md:mb-6">
                <img
                  src="/assets/upload.svg"
                  alt="Upload"
                  className="w-[60px] h-[60px] sm:w-[70px] sm:h-[70px] md:w-[80px] md:h-[80px] lg:w-[90px] lg:h-[90px]"
                />
              </div>
              <p className="text-gray-700 font-medium text-base sm:text-lg lg:text-xl mb-1 sm:mb-2">
                Choose a file or Drag and drop it here
              </p>
              <p className="text-gray-500 text-xs sm:text-sm mb-4 sm:mb-6">
                PDF only
              </p>
              <label
                htmlFor="fileInput"
                className={`${buttonStyles.browse} relative z-10`}
              >
                Browse
              </label>
              <input
                type="file"
                id="fileInput"
                className="hidden"
                accept=".pdf"
                onChange={handleFileChange}
              />
            </>
          ) : (
            /* File info and convert button - show when file is uploaded */
            <div className="flex flex-col items-center justify-center space-y-6 w-full max-w-md">
              {/* File Info Card */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 w-full shadow-sm">
                <div className="flex flex-col items-center space-y-4">
                  {/* File Icon */}
                  <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-blue-600"
                    >
                      <path
                        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <polyline
                        points="14,2 14,8 20,8"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  {/* File Name */}
                  <div className="text-center">
                    <p className="text-gray-800 font-medium text-sm truncate max-w-xs">
                      {file.originalFileName}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      {file.fileType.toUpperCase()} File
                    </p>
                  </div>

                  {/* Conversion Badge */}
                  <div className="flex items-center space-x-2 bg-blue-50 px-3 py-1 rounded-full">
                    <span className="text-blue-700 text-sm font-medium">
                      {inputFormat}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="text-blue-500"
                    >
                      <path
                        d="M13.5 4.5L21 12M21 12L13.5 19.5M21 12H3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-blue-700 text-sm font-medium">
                      {outputFormat}
                    </span>
                  </div>
                </div>
              </div>

              {/* Convert Button */}
              <button
                onClick={handleConvertClick}
                disabled={converting}
                className={`${buttonStyles.primaryFixed} ${
                  converting ? "opacity-50 cursor-not-allowed" : ""
                } relative z-10`}
              >
                {converting ? "Converting..." : "Convert File"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileFormatConversion;
