import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Spin } from "antd";
import { toast } from "react-toastify";
import { FaDownload, FaSave } from "react-icons/fa";
import { FiX } from "react-icons/fi";
import { buttonStyles } from "../../styles/buttonStyles";

const ConversionResults = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const { originalFile, inputFormat, outputFormat, convertedFile } =
    state || {};

  useEffect(() => {
    if (!originalFile || !convertedFile) {
      toast.error("No conversion data provided.");
      navigate("/file-format-conversion");
      return;
    }
    setLoading(false);
  }, [originalFile, convertedFile, navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Spin size="large" />
        <p className="mt-[1rem] text-lg">Loading conversion results...</p>
      </div>
    );
  }

  const getViewerSrc = (uri) => {
    const ext = uri.split(".").pop().toLowerCase();
    if (ext === "pdf") {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(
        uri
      )}&embedded=true`;
    } else if (["docx", "xlsx", "pptx"].includes(ext)) {
      return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(
        uri
      )}`;
    }
    return uri;
  };

  const downloadConvertedFile = () => {
    const link = document.createElement("a");
    link.href = convertedFile.url;
    link.download =
      convertedFile.name || `converted_file.${outputFormat.toLowerCase()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-full w-full flex flex-col bg-white rounded-2xl">
        {/* Format Display Panel */}
        <div className="flex flex-row p-4 gap-2 relative">
          {/* Input Format Button */}
          <button className={`${buttonStyles.secondaryFixed} text-sm`}>
            <span className="mx-auto">Original ({inputFormat})</span>
          </button>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Output Format Button */}
          <button className={`${buttonStyles.languageActive} text-sm`}>
            <span>Converted ({outputFormat})</span>
          </button>

          {/* Control buttons */}
          <div className="flex items-center gap-2 ml-2">
            <button
              className={buttonStyles.icon}
              onClick={() => navigate("/file-history")}
              title="View History"
            >
              <FaSave className="w-4 h-4" />
            </button>
            <button
              className={buttonStyles.icon}
              onClick={downloadConvertedFile}
              title="Download Converted File"
            >
              <FaDownload className="w-4 h-4" />
            </button>
            <button
              className={buttonStyles.icon}
              onClick={() => navigate("/file-format-conversion")}
              title="Close"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewer Panel */}
        <div className="flex-1 px-[1rem] pb-[1rem] relative">
          <div className="flex flex-1 h-full flex-col lg:flex-row gap-[1rem]">
            {/* Original File Viewer */}
            <div className="flex-1 h-full rounded overflow-auto">
              <div className="w-full h-full border border-gray-200 rounded-lg">
                <div className="bg-gray-50 p-3 border-b border-gray-200 rounded-t-lg">
                  <h3 className="text-sm font-medium text-gray-700">
                    Original File ({inputFormat})
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    {originalFile.originalFileName}
                  </p>
                </div>
                <iframe
                  src={getViewerSrc(originalFile.uri)}
                  className="w-full h-[calc(100%-60px)]"
                  frameBorder="0"
                  title="Original File Viewer"
                  scrolling="auto"
                  style={{ overflow: "auto" }}
                />
              </div>
            </div>

            {/* Converted File Viewer */}
            <div className="flex-1 h-full rounded overflow-auto relative">
              <div className="w-full h-full border border-blue-200 rounded-lg">
                <div className="bg-blue-50 p-3 border-b border-blue-200 rounded-t-lg">
                  <h3 className="text-sm font-medium text-blue-700">
                    Converted File ({outputFormat})
                  </h3>
                  <p className="text-xs text-blue-500 truncate">
                    {convertedFile.name}
                  </p>
                </div>
                <iframe
                  src={getViewerSrc(convertedFile.url)}
                  className="w-full h-[calc(100%-60px)]"
                  frameBorder="0"
                  title="Converted File Viewer"
                  scrolling="auto"
                  style={{ overflow: "auto" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversionResults;
