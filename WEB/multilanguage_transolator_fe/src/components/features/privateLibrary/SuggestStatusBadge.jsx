import { MdHourglassEmpty, MdCheckCircle, MdCancel } from "react-icons/md";

const config = {
  pending: {
    label: "Pending",
    icon: <MdHourglassEmpty size={13} />,
    className: "bg-yellow-100 text-yellow-700 border-yellow-300",
    tooltip: "Waiting for Admin/Library Keeper review",
  },
  approved: {
    label: "In Library",
    icon: <MdCheckCircle size={13} />,
    className: "bg-green-100 text-green-700 border-green-300",
    tooltip: "Approved into Common Library",
  },
  rejected: {
    label: "Rejected",
    icon: <MdCancel size={13} />,
    className: "bg-red-100 text-red-700 border-red-300",
    tooltip: "Rejected — you can suggest again",
  },
};

const SuggestStatusBadge = ({ status }) => {
  if (!status) return null;
  const c = config[status];
  if (!c) return null;

  return (
    <span
      title={c.tooltip}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium whitespace-nowrap ${c.className}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
};

export default SuggestStatusBadge;
