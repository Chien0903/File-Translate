import { FiTrash2 } from "react-icons/fi";

const DeleteModal = ({ onConfirm, onCancel }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center"
    style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
    onClick={onCancel}
  >
    <div
      className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-red-100 rounded-full">
          <FiTrash2 className="text-red-600" size={20} />
        </div>
        <h3 className="text-lg font-semibold text-gray-800">Delete keyword?</h3>
      </div>
      <p className="text-gray-600 text-sm mb-6">
        This keyword will be permanently removed from your private library.
      </p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

export default DeleteModal;
