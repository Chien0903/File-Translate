import { NavLink } from "react-router-dom";
import { useState } from "react";
import {
  MdDescription,
  MdTextFields,
  MdSyncAlt,
  MdHistory,
  MdBookmarkBorder,
  MdMenuBook,
  MdPeopleOutline,
  MdBarChart,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
} from "react-icons/md";
import { useAuth } from "../../../hooks/useAuth";

const NAV_MAIN = [
  { icon: MdDescription, label: "File Translation", path: "/" },
  { icon: MdTextFields, label: "Text Translation", path: "/text-translation" },
  { icon: MdSyncAlt, label: "Format Conversion", path: "/file-format-conversion" },
  { icon: MdHistory, label: "File History", path: "/file-history" },
];

const NAV_LIBRARIES = [
  { icon: MdBookmarkBorder, label: "Private Library", path: "/private-library" },
  { icon: MdMenuBook, label: "Common Library", path: "/common-library" },
];

const NAV_ADMIN = [
  { icon: MdPeopleOutline, label: "Account Management", path: "/admin" },
  { icon: MdBarChart, label: "Keyword Stats", path: "/admin/keyword-stats" },
];

const NavItem = ({ icon: Icon, label, path, expanded, isMobile, onMobileClose }) => (
  <NavLink
    to={path}
    end={path === "/" || path === "/admin"}
    onClick={() => { if (isMobile && onMobileClose) onMobileClose(); }}
    className={({ isActive }) =>
      `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
        ${isActive ? "bg-indigo-700 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`
    }
  >
    <Icon size={20} className="flex-shrink-0" />
    {(expanded || isMobile) && (
      <span className="whitespace-nowrap overflow-hidden text-ellipsis">{label}</span>
    )}
  </NavLink>
);

const SectionLabel = ({ label, expanded, isMobile }) =>
  (expanded || isMobile) ? (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 pt-4 pb-1">
      {label}
    </p>
  ) : (
    <div className="border-t border-gray-100 my-2" />
  );

const SideBar = ({ isMobile = false, onMobileClose }) => {
  const { role } = useAuth();
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={`${isMobile ? "w-64" : expanded ? "w-64" : "w-16"} h-full bg-white border-r border-gray-200 flex flex-col flex-shrink-0`}
      style={{ transition: isMobile ? "none" : "width 250ms ease" }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 h-14 border-b border-gray-200 flex-shrink-0 ${!expanded && !isMobile ? "justify-center" : ""}`}>
        <div className="w-8 h-8 bg-indigo-700 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-sm">M</span>
        </div>
        {(expanded || isMobile) && (
          <div className="min-w-0">
            <div className="font-bold text-gray-900 text-sm leading-tight truncate">Multilanguage Translator</div>
          </div>
        )}
        {isMobile && (
          <button onClick={onMobileClose} className="ml-auto p-1 text-gray-400 hover:text-gray-600">
            <MdClose size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_MAIN.map((item) => (
          <NavItem key={item.path} {...item} expanded={expanded} isMobile={isMobile} onMobileClose={onMobileClose} />
        ))}

        <SectionLabel label="Libraries" expanded={expanded} isMobile={isMobile} />
        {NAV_LIBRARIES.map((item) => (
          <NavItem key={item.path} {...item} expanded={expanded} isMobile={isMobile} onMobileClose={onMobileClose} />
        ))}

        {role === "Admin" && (
          <>
            <SectionLabel label="Admin" expanded={expanded} isMobile={isMobile} />
            {NAV_ADMIN.map((item) => (
              <NavItem key={item.path} {...item} expanded={expanded} isMobile={isMobile} onMobileClose={onMobileClose} />
            ))}
          </>
        )}
      </nav>

      {/* Collapse button */}
      {!isMobile && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 p-4 border-t border-gray-100 text-gray-400 hover:text-gray-700 text-sm transition-colors w-full"
        >
          {expanded ? (
            <><MdChevronLeft size={20} /><span>Collapse</span></>
          ) : (
            <MdChevronRight size={20} />
          )}
        </button>
      )}
    </div>
  );
};

export default SideBar;
