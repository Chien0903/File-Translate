import { FiCloud, FiCheck, FiX } from "react-icons/fi";
import PropTypes from "prop-types";

const GcsStatusModal = ({ gcsStatus, onClose }) => {
    if (!gcsStatus) return null;

    return (
        <div
            className="fixed inset-0 flex justify-center items-center z-50"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.7)" }}
            onClick={onClose}
        >
            <div
                className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-11/12"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg text-[#004098CC] font-bold mb-4 flex items-center">
                    <FiCloud className="mr-2" /> GCS Upload & Glossary Status
                </h3>

                <div className="space-y-4">
                    {/* Keywords Statistics */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-700 mb-2">
                            Keywords Statistics
                        </h4>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                                <span className="text-gray-600">Total:</span>
                                <span className="font-medium ml-1">
                                    {gcsStatus.keywords_stats?.total || 0}
                                </span>
                            </div>
                            <div>
                                <span className="text-green-600">Approved:</span>
                                <span className="font-medium ml-1">
                                    {gcsStatus.keywords_stats?.approved || 0}
                                </span>
                            </div>
                            <div>
                                <span className="text-orange-600">Pending:</span>
                                <span className="font-medium ml-1">
                                    {gcsStatus.keywords_stats?.pending || 0}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Language Pairs Supported */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-700 mb-2">
                            Supported Translation Pairs
                        </h4>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                            <div>🇻🇳 Vietnamese ↔ 🇺🇸 English</div>
                            <div>🇻🇳 Vietnamese ↔ 🇯🇵 Japanese</div>
                            <div>🇻🇳 Vietnamese ↔ 🇹🇼 Chinese (T)</div>
                            <div>🇺🇸 English ↔ 🇯🇵 Japanese</div>
                            <div>🇺🇸 English ↔ 🇹🇼 Chinese (T)</div>
                            <div>🇯🇵 Japanese ↔ 🇹🇼 Chinese (T)</div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 italic">
                            Note: Using Chinese Traditional (zh-TW) as zh-CN, Chinese
                            Simplified is excluded
                        </p>
                    </div>

                    {/* GCS File Info */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-700 mb-2">
                            GCS File Status
                        </h4>
                        {gcsStatus.gcs_file?.exists ? (
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center">
                                    <FiCheck className="text-green-500 mr-2" />
                                    <span>File exists on GCS</span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Size:</span>
                                    <span className="font-medium ml-1">
                                        {gcsStatus.gcs_file.size} bytes
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-600">Last Updated:</span>
                                    <span className="font-medium ml-1">
                                        {gcsStatus.gcs_file.updated
                                            ? new Date(
                                                gcsStatus.gcs_file.updated
                                            ).toLocaleString()
                                            : "Unknown"}
                                    </span>
                                </div>
                                <div className="bg-gray-100 p-2 rounded text-xs font-mono">
                                    {gcsStatus.gcs_file.url}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center text-sm">
                                <FiX className="text-red-500 mr-2" />
                                <span>No file found on GCS</span>
                            </div>
                        )}
                    </div>

                    {/* Permissions */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-700 mb-2">
                            Permissions
                        </h4>
                        <div className="flex items-center text-sm">
                            {gcsStatus.user_permissions?.can_upload ? (
                                <>
                                    <FiCheck className="text-green-500 mr-2" />
                                    <span>You have upload permissions</span>
                                </>
                            ) : (
                                <>
                                    <FiX className="text-red-500 mr-2" />
                                    <span>Admin permission required for upload</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Upload Status */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-700 mb-2">
                            Upload Status
                        </h4>
                        <div className="flex items-center text-sm">
                            {gcsStatus.can_upload ? (
                                <>
                                    <FiCheck className="text-green-500 mr-2" />
                                    <span>
                                        Ready to upload ({gcsStatus.keywords_stats?.approved}{" "}
                                        approved keywords)
                                    </span>
                                </>
                            ) : (
                                <>
                                    <FiX className="text-red-500 mr-2" />
                                    <span>No approved keywords available for upload</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <button
                    className="mt-6 w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    onClick={onClose}
                >
                    Close
                </button>
            </div>
        </div>
    );
};

GcsStatusModal.propTypes = {
    gcsStatus: PropTypes.object,
    onClose: PropTypes.func.isRequired,
};

export default GcsStatusModal;
