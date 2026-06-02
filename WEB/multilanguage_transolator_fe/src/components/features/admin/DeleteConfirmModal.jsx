import PropTypes from "prop-types";

const DeleteConfirmModal = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 flex justify-center items-center z-50"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.7)" }}
        >
            <div
                className="bg-white p-6 rounded-lg shadow-xl max-w-md w-11/12 text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-lg text-[#004098CC] font-bold mb-4">
                    Confirm Delete
                </h3>
                <p className="text-gray-600 mb-6">
                    Are you sure you want to delete this keyword? This action cannot
                    be undone.
                </p>
                <div className="flex justify-center gap-4">
                    <button
                        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                        onClick={onConfirm}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
};

DeleteConfirmModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onConfirm: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
};

export default DeleteConfirmModal;
