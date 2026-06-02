import { useState } from "react";
import { useNavigate } from "react-router-dom";
import userService from "../../../services/userService";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../../../constants/constants";

function LoginForm({ route, method }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Email validation function
  const validateEmail = (email) => {
    if (!email) {
      return "Email address is required";
    }

    if (!email.includes("@")) {
      return "Please enter a valid email address";
    }

    if (!email.endsWith("@mail.toray")) {
      return "Email must end with @mail.toray domain";
    }

    const localPart = email.split("@")[0];
    if (!localPart || localPart.length === 0) {
      return "Please enter a valid email address before @mail.toray";
    }

    return "";
  };

  // Handle email input change with real-time validation
  const handleEmailChange = (e) => {
    const emailValue = e.target.value;
    setEmail(emailValue);

    // Clear previous errors
    setEmailError("");
    setGeneralError("");

    // Validate email format if user has typed something
    if (emailValue) {
      const error = validateEmail(emailValue);
      if (error) {
        setEmailError(error);
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setEmailError("");
    setPasswordError("");
    setGeneralError("");

    // Validate email before submitting
    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      setLoading(false);
      return;
    }

    // Validate password
    if (!password) {
      setPasswordError("Password is required");
      setLoading(false);
      return;
    }

    try {
      const res = await userService.login(route, { email, password });

      if (method === "login" && res.status === 200) {
        localStorage.setItem(ACCESS_TOKEN, res.data.access);
        localStorage.setItem(REFRESH_TOKEN, res.data.refresh);
        const fullName = `${res.data.first_name} ${res.data.last_name}`;
        localStorage.setItem("fullName", fullName);
        localStorage.setItem("email", res.data.email);
        localStorage.setItem("role", res.data.role);
        navigate("/");
      } else {
        setGeneralError("Invalid email or password");
      }
    } catch (error) {
      console.log(error);
      if (error.response && error.response.status === 400) {
        const errorData = error.response.data;
        if (errorData.email) {
          setEmailError("Invalid email address");
        }
        if (errorData.password) {
          setPasswordError("Invalid password");
        }
        if (!errorData.email && !errorData.password) {
          setGeneralError("Invalid email or password");
        }
      } else if (error.response && error.response.status === 401) {
        setGeneralError(
          "Invalid email or password. Please check your credentials."
        );
      } else {
        setGeneralError("Unable to connect to server. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="form-container w-full">
      <div className="mb-5 text-left">
        <label className="block text-gray-700 text-sm font-normal mb-2">
          Email address
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
          </div>
          <input
            type="text"
            value={email}
            onChange={handleEmailChange}
            className={`w-full pl-10 pr-4 py-2 border ${
              emailError || generalError ? "border-red-500" : "border-gray-300"
            } rounded-md focus:outline-none focus:ring-1 focus:ring-[#004098CC]`}
            placeholder="nguyenthia@mail.toray"
          />
        </div>
        {emailError && (
          <p className="text-red-500 text-sm mt-1">{emailError}</p>
        )}
      </div>

      <div className="mb-4 text-left">
        <label className="block text-gray-700 text-sm font-normal mb-2">
          Password
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`w-full pl-10 pr-10 py-2 border ${
              passwordError || generalError
                ? "border-red-500"
                : "border-gray-300"
            } rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400`}
            placeholder="Your password"
          />
          <div
            className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer"
            onClick={togglePasswordVisibility}
          >
            {showPassword ? (
              <svg
                className="w-5 h-5 text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                  clipRule="evenodd"
                />
                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-gray-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path
                  fillRule="evenodd"
                  d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </div>
        {passwordError && (
          <p className="text-red-500 text-sm mt-1">{passwordError}</p>
        )}
        {generalError && (
          <p className="text-red-500 text-sm mt-1">{generalError}</p>
        )}
      </div>

      <div className="text-right mb-6">
        <a
          // Removed: forgot password (SSO-only)
          href="#"
          className="text-[#004098CC] text-sm hover:underline"
        >
          Forgot password?
        </a>
      </div>

      <div className="flex justify-center">
        <button
          type="submit"
          className="w-48 py-2 bg-[#004098CC] text-white rounded-full hover:bg-[#00306E] transition font-medium"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </form>
  );
}

export default LoginForm;
