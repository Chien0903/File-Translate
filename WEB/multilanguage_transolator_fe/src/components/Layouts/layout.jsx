import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "../Layouts/Header/index";
import Sidebar from "../Layouts/Sidebar/index";
import { useAuth } from "../../hooks/useAuth";

const Layout = () => {
  const { loading } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const contentRef = useRef(null);

  // Reset scroll position when navigating to a new route
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  // Show loading screen while auth is initializing (replaces ALBAuthCheck)
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-400 to-purple-600">
        <div className="bg-white rounded-lg p-8 text-center shadow-xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Initializing Authentication...
          </h2>
          <p className="text-gray-600">Verifying your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block flex-shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${mobileSidebarOpen ? "block" : "hidden"}`}
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={() => setMobileSidebarOpen(false)}
        ></div>

        {/* Mobile Sidebar */}
        <div className="relative w-64 h-full bg-white">
          <Sidebar
            isMobile={true}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
        </div>
      </div>

      {/* Main Content Area (shared for desktop and mobile) */}
      <div className="flex-1 h-full flex flex-col min-w-0">
        {/* Fixed Header */}
        <div className="flex-shrink-0 z-20">
          <Header onMobileMenuClick={() => setMobileSidebarOpen(true)} />
        </div>

        {/* Scrollable Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto scrollbar-thin p-2 bg-[#F8F8F8]">
          <Outlet />
        </div>
      </div>

    </div>
  );
};

export default Layout;
