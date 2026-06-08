import React from "react";
import RegisterForm from "../../components/features/register/index";

const RegisterPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-400 to-purple-600 relative">
      <div className="absolute inset-0 bg-black opacity-20 pointer-events-none" />

      {/* Header Section */}
      <header className="w-full bg-white bg-opacity-90 py-4 px-8 shadow-md z-20">
        <div className="flex items-center justify-between">
          <div />
          <span className="text-2xl font-semibold text-blue-900 uppercase">
            Multi-Language Translator
          </span>
          <nav>
            <span className="text-gray-600 cursor-default mx-4">Home</span>
            <a href="/about" className="text-gray-600 hover:text-blue-600 transition-colors mx-4">
              About
            </a>
            <a href="/contact" className="text-gray-600 hover:text-blue-600 transition-colors mx-4">
              Contact
            </a>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <div className="flex items-center justify-center flex-1 w-full">
        <div className="relative z-30 bg-white rounded-2xl shadow-lg p-8 w-[28rem] text-center mx-auto my-8">
          <h1 className="text-2xl font-semibold mb-6">Sign up</h1>
          <RegisterForm route="/api/user/register/" />
          <p className="mt-6 text-gray-600 text-sm">
            Already have an account?
            <a href="/login" className="text-[#004098CC] hover:underline ml-1">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
