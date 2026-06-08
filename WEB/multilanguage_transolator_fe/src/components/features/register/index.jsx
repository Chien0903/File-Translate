import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../../../constants/constants";
import { toast } from "react-toastify";
import { FiAlertCircle } from "react-icons/fi";
import userService from "../../../services/userService";

// eslint-disable-next-line react/prop-types
function RegisterForm({ route }) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const navigate = useNavigate();

  const notifyError = (msg) =>
    toast.error(msg, {
      style: { backgroundColor: "#f44336", color: "white" },
      icon: <FiAlertCircle />,
    });

  const notifySuccess = () =>
    toast.success("🎉 Account created successfully!", {
      style: { backgroundColor: "#4caf50", color: "white" },
      position: "top-center",
      autoClose: 3000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });

  const validateEmailRealTime = (emailValue) => {
    if (!emailValue) return "Please enter your email address";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) return "Please enter a valid email address";
    return "";
  };

  const handleEmailChange = (e) => {
    const emailValue = e.target.value;
    setEmail(emailValue);
    
    if (emailTouched) {
      const error = validateEmailRealTime(emailValue);
      setEmailError(error);
    }
  };

  const handleEmailBlur = () => {
    setEmailTouched(true);
    const error = validateEmailRealTime(email);
    setEmailError(error);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!firstName.trim()) {
      notifyError("Please enter your first name!");
      setLoading(false);
      return;
    }
    if (!lastName.trim()) {
      notifyError("Please enter your last name!");
      setLoading(false);
      return;
    }
    
    const emailValidationError = validateEmailRealTime(email);
    if (emailValidationError) {
      notifyError(emailValidationError);
      setEmailError(emailValidationError);
      setEmailTouched(true);
      setLoading(false);
      return;
    }
    
    if (password !== confirmPassword) {
      notifyError("Password confirmation doesn't match!");
      setLoading(false);
      return;
    }

    try {
      const data = {
        email,
        first_name: firstName,
        last_name: lastName,
        password,
        confirm_password: confirmPassword,
      };

      const res = await userService.register(route, data, {
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === 201 || res.status === 200) {
        if (res.data.access && res.data.refresh) {
          localStorage.setItem(ACCESS_TOKEN, res.data.access);
          localStorage.setItem(REFRESH_TOKEN, res.data.refresh);
        }
        notifySuccess();

        // Redirect to login page after 2 seconds to let user see the success message
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        notifyError("Registration failed!");
      }
    } catch (error) {
      console.error(error);
      let errorMessage = "Registration failed!";

      if (error.response?.data) {
        // Handle different types of errors
        if (typeof error.response.data === "string") {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.email) {
          errorMessage = `Email error: ${error.response.data.email[0]}`;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else {
          // Handle field-specific errors
          const errors = Object.entries(error.response.data).map(
            ([field, messages]) => {
              const fieldName = field
                .replace("_", " ")
                .replace(/\b\w/g, (l) => l.toUpperCase());
              return `${fieldName}: ${
                Array.isArray(messages) ? messages[0] : messages
              }`;
            }
          );
          errorMessage = errors.join(", ");
        }
      }

      notifyError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="text-left">
      <div className="mb-4">
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
            onBlur={handleEmailBlur}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#004098CC]"
            placeholder="example@email.com"
            required
          />
        </div>
        {emailError && (
          <p className="text-red-500 text-sm mt-1">{emailError}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-gray-700 text-sm font-normal mb-2">
            First Name
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
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#004098CC]"
              placeholder="Enter first name"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-normal mb-2">
            Last Name
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
                  d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#004098CC]"
              placeholder="Enter last name"
              required
            />
          </div>
        </div>
      </div>

      <div className="mb-4">
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
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#004098CC]"
            placeholder="Enter password"
            required
          />
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-gray-700 text-sm font-normal mb-2">
          Confirm Password
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
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#004098CC]"
            placeholder="Confirm password"
            required
          />
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="submit"
          disabled={loading}
          className={`w-56 py-2 text-white rounded-full transition font-medium flex items-center justify-center ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#004098CC] hover:bg-[#00306E]"
          }`}
        >
          {loading ? (
            <div className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Creating Account...
            </div>
          ) : (
            "Sign up"
          )}
        </button>
      </div>
    </form>
  );
}

export default RegisterForm;
