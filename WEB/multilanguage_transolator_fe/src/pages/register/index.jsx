import React, { useState, useEffect } from "react";
import RegisterForm from "../../components/features/register/index";

const images = [
  "https://www.toray.com/global/images/index_kv_06.webp",
  "https://www.toray.com/global/images/index_kv_08.webp",
  "https://www.toray.com/global/images/index_kv_04.webp",
  "https://www.toray.com/global/images/index_kv_01.webp",
  "https://www.toray.com/global/images/index_kv_05.webp",
  "https://www.toray.com/global/images/index_kv_02.webp",
];

const RegisterPage = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

return (
  <div className="flex flex-col min-h-screen bg-blue-100 relative">
      {/* Background Slideshow */}
      <div className="absolute inset-0 w-full h-full">
        {images.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
              index === currentImageIndex ? "opacity-100" : "opacity-0"
            }`}
            style={{ backgroundImage: `url(${image})` }}
          ></div>
        ))}
      </div>

      {/* Header Section */}
      <header className="w-full bg-white bg-opacity-90 py-4 px-8 shadow-md z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img
              src="https://www.toray.com/global/shared/images/toray_logo.svg"
              alt="Toray Logo"
              className="h-10"
            />
          </div>
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <span className="text-2xl font-semibold text-blue-900 uppercase">
              Multi-Language Translator
            </span>
          </div>
          <nav>
            <span className="text-gray-600 cursor-default mx-4">
              Home
            </span>
            <a
              href="/about"
              className="text-gray-600 hover:text-blue-600 transition-colors mx-4"
            >
              About
            </a>
            <a
              href="/contact"
              className="text-gray-600 hover:text-blue-600 transition-colors mx-4"
            >
              Contact
            </a>
          </nav>
        </div>
      </header>

      {/* Main content container - full height minus header */}
      <div className="flex items-center justify-center flex-1 w-full">
        {/* Signup Card */}
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