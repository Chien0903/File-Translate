import { useEffect } from "react";
import albAuthService from "../../../services/albAuthService";

/**
 * Component to automatically redirect to SSO login
 * Used when user is not authenticated and needs to login
 */
const SSORedirect = ({ message = "Redirecting to SSO Login..." }) => {
  useEffect(() => {
    const redirectToSSO = async () => {
      try {
        // Clear any existing local auth
        albAuthService.clearLocalAuth();

        // Check if already authenticated via ALB
        const albAuth = await albAuthService.checkALBAuth();
        if (albAuth.authenticated) {
          // Already authenticated, go to home
          window.location.href = "/";
          return;
        }

        // Force reload to trigger ALB authentication
        setTimeout(() => {
          window.location.href = window.location.origin;
        }, 1000);
      } catch (error) {
        console.error("SSO redirect error:", error);
        // Force reload anyway
        window.location.href = window.location.origin;
      }
    };

    redirectToSSO();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-400 to-purple-600">
      <div className="bg-white rounded-lg p-8 text-center shadow-xl max-w-md">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">{message}</h2>
        <p className="text-gray-600 mb-4">
          🔐 This application uses Single Sign-On (SSO) for security.
        </p>
        <p className="text-sm text-gray-500">
          You will be redirected to the secure login page...
        </p>
        <button
          onClick={() => (window.location.href = window.location.origin)}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Continue to SSO
        </button>
      </div>
    </div>
  );
};

export default SSORedirect;
