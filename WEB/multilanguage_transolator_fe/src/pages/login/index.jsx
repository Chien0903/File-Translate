import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { MdEmail, MdLock, MdVisibility, MdVisibilityOff } from "react-icons/md";

const LoginPage = () => {
  const { login, authenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && authenticated) navigate("/", { replace: true });
  }, [authenticated, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Email is required."); return; }
    if (!password) { setError("Password is required."); return; }
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex">
      {/* Left panel — gradient */}
      <div className="hidden md:flex flex-col items-center justify-center w-1/2 bg-gradient-to-br from-indigo-500 to-indigo-900 p-12 text-white">
        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
          <span className="text-white font-bold text-3xl">T</span>
        </div>
        <h1 className="text-3xl font-bold text-center mb-3">Multi-Language Translator</h1>
        <p className="text-indigo-200 text-center text-sm mb-8">Breaking language barriers across your company.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col items-center justify-center w-full md:w-1/2 bg-white p-8">
        {/* Mobile logo */}
        <div className="md:hidden mb-8 text-center">
          <div className="w-12 h-12 bg-indigo-700 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-xl">T</span>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-gray-400 text-sm mb-8">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <MdEmail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="you@company.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <MdLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-indigo-700 text-white rounded-full font-semibold text-sm hover:bg-indigo-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-300 mt-8">© Multilanguage Translator</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
