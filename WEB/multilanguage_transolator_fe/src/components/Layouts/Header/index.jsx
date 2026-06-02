import { useState, useEffect } from "react";
import { IoChevronDown } from "react-icons/io5";
import { FaUser } from "react-icons/fa";
import { HiMenu } from "react-icons/hi";
import { useNavigate } from "react-router-dom";
import Notifications from "../../../components/Notifications";
import { ICON_SIZES } from "../../../constants/constants";
import { useAuth } from "../../../hooks/useAuth";

const Header = ({ onMobileMenuClick }) => {
  const { fullName, role } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();

  // Handle clicking outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUserMenu) {
        const target = event.target;
        if (!target.closest(".user-menu")) {
          setShowUserMenu(false);
        }
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showUserMenu]);

  return (
    <div className="bg-white flex items-center p-4 border border-gray-200 w-full relative">
      {/* Mobile Menu Button */}
      <div className="md:hidden mr-3">
        <button
          onClick={onMobileMenuClick}
          className="p-2 rounded-md hover:bg-gray-100 transition-colors"
        >
          <HiMenu size={ICON_SIZES.INTERFACE_LARGE} className="text-gray-600" />
        </button>
      </div>

      {/* Logo */}
      <div className="z-10">
        <img
          src="/assets/toraylogo.webp"
          alt="Toray Logo"
          className="h-10 cursor-pointer"
          onClick={() => navigate("/")}
        />
      </div>

      {/* User menu and notifications on right */}
      <div className="flex items-center ml-auto gap-4" style={{ zIndex: '50' }}>
        {/* Notifications Component */}
        <Notifications />

        {/* User Profile */}
        <div
          className="user-menu relative inline-flex items-center whitespace-nowrap cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setShowUserMenu(!showUserMenu);
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <FaUser size={ICON_SIZES.INTERFACE_DEFAULT} className="text-gray-500" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold">{fullName}</span>
              <span className="text-xs text-gray-600">{role}</span>
            </div>
            <IoChevronDown className="ml-1 text-gray-500" />
          </div>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-2xl shadow-md w-full min-w-full z-50 overflow-hidden whitespace-nowrap">
              <ul className="flex flex-col p-2">
                <li
                  className="px-5 py-3 rounded text-base font-normal text-gray-800 cursor-pointer text-left hover:bg-[#0477BF] hover:text-white transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/my-profile");
                    setShowUserMenu(false);
                  }}
                >
                  My account
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;
