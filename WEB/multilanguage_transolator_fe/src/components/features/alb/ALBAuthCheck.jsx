import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import albAuthService from "../../../services/albAuthService";

/**
 * Component to check ALB authentication status on app initialization
 */
const ALBAuthCheck = ({ children }) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Chỉ initialize một lần để tránh loops
    let mounted = true;

    const initialize = async () => {
      if (mounted) {
        await initializeAuthentication();
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  const initializeAuthentication = async () => {
    try {
      const authResult = await albAuthService.initializeAuth();

      if (authResult.authenticated) {
        console.log("✅ Authentication initialized:", {
          provider: authResult.provider || "alb_cognito",
          user: authResult.user?.email,
        });
      } else {
        console.log("❌ No authentication found");
      }
    } catch (error) {
      console.error("Authentication initialization failed:", error);
    } finally {
      setLoading(false);
    }
  };

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

  // Pass auth status to children via context or props
  return children;
};

ALBAuthCheck.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ALBAuthCheck;
