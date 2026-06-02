import { useEffect, useState } from "react";
import albAuthService from "../../services/albAuthService";

const LoginPage = () => {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Clear any existing local auth
    albAuthService.clearLocalAuth();

    // Check if we already have ALB authentication
    const checkALBAuth = async () => {
      try {
        const albAuth = await albAuthService.checkALBAuth();
        if (albAuth.authenticated) {
          // Already authenticated, redirect to home
          window.location.href = "/";
          return;
        }
      } catch (error) {
        console.log("No ALB auth found, proceeding with SSO redirect");
      }

      // Start countdown and then force SSO redirect
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Force redirect to trigger ALB authentication
            window.location.href = window.location.origin;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    };

    checkALBAuth();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-400 to-purple-600 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-black opacity-30"></div>

      {/* Header Section */}
      <header className="w-full bg-white bg-opacity-90 py-4 px-8 shadow-md z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="/assets/zerobarrier.webp"
              alt="Zerobarrier"
              className="h-10"
            />
          </div>
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <span className="text-2xl font-semibold text-blue-900 uppercase">
              Multi-Language Translator
            </span>
          </div>
        </div>
      </header>

      {/* Main content container */}
      <div className="flex items-center justify-center flex-1 w-full">
        {/* SSO Redirect Card */}
        <div className="bg-white bg-opacity-95 rounded-2xl shadow-2xl p-10 w-96 text-center mx-auto relative z-10 my-8">
          <div className="mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h1 className="text-2xl font-semibold mb-4 text-gray-800">
              Redirecting to SSO Login
            </h1>
          </div>

          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              <strong>🔐 Single Sign-On (SSO) Required</strong>
              <br />
              You will be redirected to the secure login page in{" "}
              <span className="font-bold text-blue-900">{countdown}</span>{" "}
              seconds.
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
            <p>
              <strong>What's happening?</strong>
            </p>
            <p>• This application uses enterprise SSO for security</p>
            <p>• You'll be redirected to the Cognito login page</p>
            <p>• After login, you'll return here automatically</p>
          </div>

          <button
            onClick={() => (window.location.href = window.location.origin)}
            className="mt-6 w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Redirect Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
