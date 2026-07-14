import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import userService from "../../../services/userService";
import { toast } from "react-toastify";
import { MdLock, MdVisibility, MdVisibilityOff } from "react-icons/md";

const EditUserRole = ({ isOpen, onClose, userId, onUserUpdated }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("User");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (isOpen && userId) {
      setNewPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setError("");
      setLoadError("");
      fetchUser();
    }
  }, [isOpen, userId]);

  const fetchUser = async () => {
    try {
      const response = await userService.getUser(userId);

      setFirstName(response.data.first_name);
      setLastName(response.data.last_name);
      setEmail(response.data.email);
      setRole(response.data.role);
    } catch (error) {
      console.error("Error fetching user info:", error);
      setLoadError("Profile not available. Please try again.");
    } finally {
      setDataLoading(false);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      await userService.updateUserRole(userId, role);
      if (newPassword) {
        await userService.setUserPassword(userId, newPassword);
      }
      toast.success("Updated successfully");

      const currentUserEmail = localStorage.getItem("email");
      if (email === currentUserEmail) {
        localStorage.setItem("role", role);
        window.dispatchEvent(new Event("storage"));
      }

      // Thông báo cho component cha để refresh lại danh sách user
      if (onUserUpdated) {
        onUserUpdated();
      }

      onClose();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error(error.response?.data?.detail || "Unable to update user");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[1000]">
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="bg-white rounded-lg p-8 w-full max-w-2xl relative shadow-2xl transform transition-all">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-indigo-700 mb-2">
            Edit User Role
          </h3>
          <p className="text-gray-600 text-sm">Manage user role information</p>
        </div>

        {dataLoading ? (
          <p className="text-center text-blue-600">Loading data...</p>
        ) : loadError ? (
          <p className="text-red-500 text-center">{loadError}</p>
        ) : (
          <form onSubmit={handleUpdateRole} className="space-y-5">
            {/* Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-gray-700 text-sm font-semibold">
                  First Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={firstName}
                    disabled
                    className="w-full p-3 pl-10 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-gray-700 text-sm font-semibold">
                  Last Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={lastName}
                    disabled
                    className="w-full p-3 pl-10 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label className="block text-gray-700 text-sm font-semibold">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full p-3 pl-10 border-2 border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <label className="block text-gray-700 text-sm font-semibold">
                Account Role <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {["User", "Admin", "Library Keeper"].map((r) => (
                  <label
                    key={r}
                    className={`flex items-center space-x-3 cursor-pointer p-4 border-2 rounded-lg transition-all duration-200 ${role === r
                      ? "border-indigo-700 bg-indigo-700/5"
                      : "border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="w-4 h-4 text-indigo-700 focus:ring-indigo-700 focus:ring-2"
                    />
                    <span
                      className={`font-medium ${role === r ? "text-indigo-700" : "text-gray-700"
                        }`}
                    >
                      {r}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Reset Password */}
            <div className="space-y-2">
              <label className="block text-gray-700 text-sm font-semibold">
                Reset Password
              </label>
              <p className="text-xs text-gray-400">Leave blank to keep the current password.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <MdLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    autoComplete="new-password"
                    className="w-full p-3 pl-10 pr-10 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                  </button>
                </div>
                <div className="relative">
                  <MdLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    className="w-full p-3 pl-10 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            {/* Action Buttons */}
            <div className="flex justify-center gap-4 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold transition-all duration-200 border border-gray-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white rounded-lg hover:from-indigo-800 hover:to-[#035a9e] font-semibold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

EditUserRole.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onUserUpdated: PropTypes.func,
};

export default EditUserRole;
