import { FiX } from "react-icons/fi";
import { MdHourglassEmpty, MdCheckCircle, MdCancel } from "react-icons/md";

const StatusLegend = ({ onClose }) => (
  <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-4">
    <div className="flex items-center justify-between mb-3">
      <h4 className="font-semibold text-gray-700 text-sm">Suggestion Statuses</h4>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
        <FiX size={15} />
      </button>
    </div>
    <div className="space-y-3 text-xs text-gray-600">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-gray-400 font-medium shrink-0">—</span>
        <div>
          <span className="font-medium text-gray-700">Not suggested</span>
          <p>Not yet submitted to the library. Select and click <em>Suggest</em> to submit.</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <MdHourglassEmpty className="text-yellow-500 mt-0.5 shrink-0" size={15} />
        <div>
          <span className="font-medium text-yellow-700">Pending</span>
          <p>Waiting for Admin / Library Keeper review. Cannot re-submit while pending.</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <MdCheckCircle className="text-green-600 mt-0.5 shrink-0" size={15} />
        <div>
          <span className="font-medium text-green-700">In Library</span>
          <p>Approved and added to THK Library. This keyword is now in the shared library.</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <MdCancel className="text-red-500 mt-0.5 shrink-0" size={15} />
        <div>
          <span className="font-medium text-red-700">Rejected</span>
          <p>Rejected. You can select and re-submit the suggestion.</p>
        </div>
      </div>
    </div>
  </div>
);

export default StatusLegend;
