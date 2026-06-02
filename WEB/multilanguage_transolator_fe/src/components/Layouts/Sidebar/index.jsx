import {
  MdTranslate,
  MdHistory,
  MdLibraryBooks,
  MdManageAccounts,
  MdMenu,
  MdNoteAlt,
  MdRuleFolder,
  MdTransform,
  MdTextFields,
  MdBarChart,
  MdBookmark,
} from "react-icons/md";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { ICON_SIZES } from "../../../constants/constants";
import { useAuth } from "../../../hooks/useAuth";

const SideBar = ({ onExpandChange, isMobile = false, onMobileClose }) => {
  const { role } = useAuth();
  const [expanded, setExpanded] = useState(isMobile ? true : false); // Always expanded on mobile
  const navigate = useNavigate();
  const location = useLocation();

  // Notify parent component when expanded state changes
  useEffect(() => {
    if (onExpandChange) {
      onExpandChange(expanded);
    }
  }, [expanded, onExpandChange]);

  const toggleSidebar = () => {
    if (!isMobile) {
      setExpanded(!expanded);
    }
  };

  // Handle navigation with mobile close
  const handleNavigate = (path) => {
    navigate(path);
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div
      className={`${isMobile ? "w-64" : expanded ? "w-[15rem]" : "w-[5rem]"
        } h-full bg-white border-r border-gray-200 shadow-sm flex flex-col py-[1.5rem] relative overflow-hidden`}
      style={{
        transition: isMobile
          ? "none"
          : "width 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        willChange: "width",
      }}
    >
      {/* Toggle Button / Mobile Close Button */}
      <div
        className={`flex items-center justify-center cursor-pointer hover:bg-gray-100 p-[0.5rem] mb-[1.5rem] w-full transition-colors duration-200 ${isMobile ? "justify-between px-[1.5rem]" : "justify-center"
          }`}
        onClick={isMobile ? onMobileClose : toggleSidebar}
      >
        {isMobile && (
          <>
            <span className="text-lg font-semibold text-[#004098]">Menu</span>
            <div className="text-[#0477BF] bg-[#E6F1F8] rounded-full p-[0.5rem] transition-all duration-300 hover:scale-110">
              <MdMenu size={ICON_SIZES.INTERFACE_LARGE} />
            </div>
          </>
        )}
        {!isMobile && (
          <div className="text-[#0477BF] bg-[#E6F1F8] rounded-full p-[0.5rem] transition-all duration-300 hover:scale-110">
            <MdMenu size={ICON_SIZES.INTERFACE_LARGE} />
          </div>
        )}
      </div>

      {/* Menu Items */}
      <div className="flex flex-col w-full space-y-[0.25rem] h-full">
        {/* File Translation */}
        <div
          className={`flex items-center cursor-pointer p-[0.75rem] ${isActive("/") ? "bg-[#0477BF] text-white" : "hover:bg-gray-100"
            } mx-[0.75rem] rounded-md transition-all duration-200`}
          onClick={() => handleNavigate("/")}
        >
          <MdTranslate
            size={ICON_SIZES.INTERFACE_LARGE}
            className={`${isActive("/") ? "text-white" : "text-gray-500"
              } flex-shrink-0 transition-colors duration-200`}
          />
          <span
            className="ml-[0.75rem] font-medium whitespace-nowrap"
            style={{
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateX(0)" : "translateX(-10px)",
              transition:
                "opacity 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms, transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms",
              transitionDelay: expanded ? "100ms" : "0ms",
            }}
          >
            File Translation
          </span>
        </div>

        {/* Text Translation - Temporarily Hidden */}

        <div
          className={`flex items-center cursor-pointer p-[0.75rem] ${isActive("/text-translation")
              ? "bg-[#0477BF] text-white"
              : "hover:bg-gray-100"
            } mx-[0.75rem] rounded-md transition-all duration-200`}
          onClick={() => handleNavigate("/text-translation")}
        >
          <MdTextFields
            size={ICON_SIZES.INTERFACE_LARGE}
            className={`${isActive("/text-translation") ? "text-white" : "text-gray-500"
              } flex-shrink-0 transition-colors duration-200`}
          />
          <span
            className="ml-[0.75rem] font-medium whitespace-nowrap"
            style={{
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateX(0)" : "translateX(-10px)",
              transition:
                "opacity 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms, transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms",
              transitionDelay: expanded ? "110ms" : "0ms",
            }}
          >
            Text Translation
          </span>
        </div>


        {/* File Format Conversion */}
        <div
          className={`flex items-center cursor-pointer p-[0.75rem] ${isActive("/file-format-conversion")
              ? "bg-[#0477BF] text-white"
              : "hover:bg-gray-100"
            } mx-[0.75rem] rounded-md transition-all duration-200`}
          onClick={() => handleNavigate("/file-format-conversion")}
        >
          <MdTransform
            size={ICON_SIZES.INTERFACE_LARGE}
            className={`${isActive("/file-format-conversion")
                ? "text-white"
                : "text-gray-500"
              } flex-shrink-0 transition-colors duration-200`}
          />
          <span
            className="ml-[0.75rem] font-medium whitespace-nowrap"
            style={{
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateX(0)" : "translateX(-10px)",
              transition:
                "opacity 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms, transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms",
              transitionDelay: expanded ? "120ms" : "0ms",
            }}
          >
            Format Conversion
          </span>
        </div>

        {/* File history */}
        <div
          className={`flex items-center cursor-pointer p-[0.75rem] ${isActive("/file-history")
              ? "bg-[#0477BF] text-white"
              : "hover:bg-gray-100"
            } mx-[0.75rem] rounded-md transition-all duration-200`}
          onClick={() => handleNavigate("/file-history")}
        >
          <MdHistory
            size={ICON_SIZES.INTERFACE_LARGE}
            className={`${isActive("/file-history") ? "text-white" : "text-gray-500"
              } flex-shrink-0 transition-colors duration-200`}
          />
          <span
            className="ml-[0.75rem] font-medium whitespace-nowrap"
            style={{
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateX(0)" : "translateX(-10px)",
              transition:
                "opacity 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms, transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms",
              transitionDelay: expanded ? "140ms" : "0ms",
            }}
          >
            File history
          </span>
        </div>

        {/* Admin and Library sections */}
        <div className="flex-grow"></div>

        {/* Private Library */}
        <div
          className={`flex items-center cursor-pointer p-[0.75rem] ${isActive("/private-library")
              ? "bg-[#0477BF] text-white"
              : "hover:bg-gray-100"
            } mx-[0.75rem] rounded-md transition-all duration-200`}
          onClick={() => handleNavigate("/private-library")}
        >
          <MdBookmark
            size={ICON_SIZES.INTERFACE_LARGE}
            className={`${isActive("/private-library") ? "text-white" : "text-gray-500"
              } flex-shrink-0 transition-colors duration-200`}
          />
          <span
            className="ml-[0.75rem] font-medium whitespace-nowrap"
            style={{
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateX(0)" : "translateX(-10px)",
              transition:
                "opacity 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms, transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms",
              transitionDelay: expanded ? "130ms" : "0ms",
            }}
          >
            Private Library
          </span>
        </div>

        {/* Suggestion Review - HIDDEN
        {(role === "Admin" || role === "Library Keeper") && (
          <div
            className={`flex items-center cursor-pointer p-[0.75rem] ${isActive("/suggestion-review")
                ? "bg-[#0477BF] text-white"
                : "hover:bg-gray-100"
              } mx-[0.75rem] rounded-md transition-all duration-200`}
            onClick={() => handleNavigate("/suggestion-review")}
          >
            <MdRuleFolder
              size={ICON_SIZES.INTERFACE_LARGE}
              className={`${isActive("/suggestion-review") ? "text-white" : "text-gray-500"
                } flex-shrink-0 transition-colors duration-200`}
            />
            <span
              className="ml-[0.75rem] font-medium whitespace-nowrap"
              style={{
                opacity: expanded ? 1 : 0,
                transform: expanded ? "translateX(0)" : "translateX(-10px)",
                transition:
                  "opacity 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms, transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms",
                transitionDelay: expanded ? "140ms" : "0ms",
              }}
            >
              Review Suggestions
            </span>
          </div>
        )}
        */}

        {/* Library */}
        <div
          className={`flex items-center cursor-pointer p-[0.75rem] ${isActive("/common-library")
              ? "bg-[#0477BF] text-white"
              : "hover:bg-gray-100"
            } mx-[0.75rem] rounded-md transition-all duration-200`}
          onClick={() => handleNavigate("/common-library")}
        >
          <MdLibraryBooks
            size={ICON_SIZES.INTERFACE_LARGE}
            className={`${isActive("/common-library") ? "text-white" : "text-gray-500"
              } flex-shrink-0 transition-colors duration-200`}
          />
          <span
            className="ml-[0.75rem] font-medium whitespace-nowrap"
            style={{
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateX(0)" : "translateX(-10px)",
              transition:
                "opacity 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms, transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms",
              transitionDelay: expanded ? "160ms" : "0ms",
            }}
          >
            THK Library
          </span>
        </div>

        {/* Account Management */}
        {role === "Admin" && (
          <div
            className={`flex items-center cursor-pointer p-[0.75rem] ${isActive("/admin")
                ? "bg-[#0477BF] text-white"
                : "hover:bg-gray-100"
              } mx-[0.75rem] rounded-md transition-all duration-200`}
            onClick={() => handleNavigate("/admin")}
          >
            <MdManageAccounts
              size={ICON_SIZES.INTERFACE_LARGE}
              className={`${isActive("/admin") ? "text-white" : "text-gray-500"
                } flex-shrink-0 transition-colors duration-200`}
            />
            <span
              className="ml-[0.75rem] font-medium whitespace-nowrap"
              style={{
                opacity: expanded ? 1 : 0,
                transform: expanded ? "translateX(0)" : "translateX(-10px)",
                transition:
                  "opacity 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms, transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms",
                transitionDelay: expanded ? "180ms" : "0ms",
              }}
            >
              Account Management
            </span>
          </div>
        )}

        {/* Keyword Stats */}
        {role === "Admin" && (
          <div
            className={`flex items-center cursor-pointer p-[0.75rem] ${isActive("/admin/keyword-stats")
                ? "bg-[#0477BF] text-white"
                : "hover:bg-gray-100"
              } mx-[0.75rem] rounded-md transition-all duration-200`}
            onClick={() => handleNavigate("/admin/keyword-stats")}
          >
            <MdBarChart
              size={ICON_SIZES.INTERFACE_LARGE}
              className={`${isActive("/admin/keyword-stats") ? "text-white" : "text-gray-500"
                } flex-shrink-0 transition-colors duration-200`}
            />
            <span
              className="ml-[0.75rem] font-medium whitespace-nowrap"
              style={{
                opacity: expanded ? 1 : 0,
                transform: expanded ? "translateX(0)" : "translateX(-10px)",
                transition:
                  "opacity 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms, transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94) 50ms",
                transitionDelay: expanded ? "190ms" : "0ms",
              }}
            >
              Keyword Stats
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SideBar;
