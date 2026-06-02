import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "../Layouts/Header/index";
import Sidebar from "../Layouts/Sidebar/index";
import Button from "../common/Button";
import { useAuth } from "../../hooks/useAuth";

const Layout = () => {
  const { loading } = useAuth();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showPolicyPopup, setShowPolicyPopup] = useState(false);

  useEffect(() => {
    const hasSeenPolicy = sessionStorage.getItem("hasSeenPolicy");
    if (!hasSeenPolicy) {
      setShowPolicyPopup(true);
    }
  }, []);

  const handlePolicyAccept = () => {
    sessionStorage.setItem("hasSeenPolicy", "true");
    setShowPolicyPopup(false);
  };

  // Show loading screen while auth is initializing (replaces ALBAuthCheck)
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-400 to-purple-600">
        <div className="bg-white rounded-lg p-8 text-center shadow-xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Initializing Authentication...
          </h2>
          <p className="text-gray-600">Checking ALB authentication status</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden">
      {/* Desktop Fixed Sidebar */}
      <div className="fixed left-0 top-0 h-full z-30 hidden md:block">
        <Sidebar onExpandChange={setSidebarExpanded} />
      </div>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${mobileSidebarOpen ? "block" : "hidden"
          }`}
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50"
          onClick={() => setMobileSidebarOpen(false)}
        ></div>

        {/* Mobile Sidebar */}
        <div className="relative w-64 h-full bg-white">
          <Sidebar
            onExpandChange={() => { }}
            isMobile={true}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
        </div>
      </div>

      {/* Desktop Main Content Area */}
      <div
        className="h-full flex-col transition-all duration-300 ease-in-out hidden md:flex"
        style={{
          marginLeft: sidebarExpanded ? "15rem" : "5rem",
        }}
      >
        {/* Fixed Header */}
        <div className="flex-shrink-0 z-20">
          <Header onMobileMenuClick={() => setMobileSidebarOpen(true)} />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 bg-[#F8F8F8]">
          <Outlet />
        </div>
      </div>

      {/* Mobile Content - full width on mobile */}
      <div className="md:hidden h-full flex flex-col">
        {/* Fixed Header */}
        <div className="flex-shrink-0 z-20">
          <Header onMobileMenuClick={() => setMobileSidebarOpen(true)} />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 bg-[#F8F8F8]">
          <Outlet />
        </div>
      </div>

      {/* Policy Popup */}
      {showPolicyPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6 space-y-4 border border-gray-200 relative z-[70]">
            <h2 className="text-xl font-bold text-red-600 border-b pb-2">
              Internal Use Policy: Please Read Before Using
            </h2>
            <div className="text-gray-700 space-y-3 text-base leading-relaxed">
              <p>
                This internal website is for the sharing of company information. However, you are strictly prohibited from uploading Top Secret, Highly Sensitive, or Restricted company data.
              </p>
              <p>
                Furthermore, any content that violates laws, regulations, or public decency/order is also strictly forbidden. Users are solely responsible for ensuring uploaded content complies with all applicable policies and laws.
              </p>
              <p className="font-semibold text-gray-900">
                The company disclaims all liability for violations.
              </p>
            </div>
            <div className="flex justify-end pt-4 border-t mt-4">
              <Button onClick={handlePolicyAccept} variant="primary" className="min-w-[100px]">
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
