import { useState, useEffect } from "react";
import { MdNotificationsNone, MdLogout } from "react-icons/md";
import { HiMenu } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";

const Header = ({ onMobileMenuClick }) => {
  const { fullName, role, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".user-menu-container")) setShowUserMenu(false);
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const initials = fullName
    ? fullName.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="bg-white border-b border-gray-200 px-5 h-14 flex items-center justify-between flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuClick}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <HiMenu size={20} />
        </button>
        <span className="font-semibold text-gray-800 text-sm">Multi-Language Translator</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <MdNotificationsNone size={22} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User avatar + name */}
        <div
          className="user-menu-container relative flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu); }}
        >
          <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-semibold text-gray-900 leading-tight">{fullName}</div>
            <div className="text-xs text-gray-400 leading-tight">{role}</div>
          </div>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg w-44 z-50 overflow-hidden">
              <button
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                onClick={(e) => { e.stopPropagation(); navigate("/my-profile"); setShowUserMenu(false); }}
              >
                My account
              </button>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="Sign out"
        >
          <MdLogout size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
