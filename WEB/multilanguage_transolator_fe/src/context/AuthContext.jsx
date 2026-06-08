import { createContext, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import authService from "../services/authService";
import api from "../services/api";

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    authenticated: false,
    loading: true,
    user: null,
    fullName: "",
    email: "",
    role: "",
  });

  // On mount: if token exists in localStorage, fetch /auth/me to validate
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      if (!authService.isAuthenticated()) {
        if (mounted) setAuthState((prev) => ({ ...prev, loading: false }));
        return;
      }
      try {
        const res = await api.get("/auth/me/");
        if (mounted && res.data) {
          const user = res.data;
          setAuthState({
            authenticated: true,
            loading: false,
            user,
            fullName: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
            email: user.email ?? "",
            role: user.role ?? "",
          });
        }
      } catch {
        // Token invalid or expired (refresh also failed → api.js already redirected)
        if (mounted) setAuthState((prev) => ({ ...prev, loading: false, authenticated: false }));
      }
    };

    initialize();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authService.login(email, password);
    const user = data.user;
    setAuthState({
      authenticated: true,
      loading: false,
      user,
      fullName: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
      email: user.email ?? "",
      role: user.role ?? "",
    });
    return data;
  }, []);

  const logout = useCallback(() => authService.logout(), []);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await api.get("/auth/me/");
      const user = res.data;
      setAuthState((prev) => ({
        ...prev,
        authenticated: true,
        user,
        fullName: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
        email: user.email ?? "",
        role: user.role ?? "",
      }));
    } catch {
      // ignore — interceptor handles redirect if needed
    }
  }, []);

  const updateRole = useCallback((newRole) => {
    localStorage.setItem("role", newRole);
    setAuthState((prev) => ({ ...prev, role: newRole }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...authState, login, logout, refreshAuth, updateRole }}>
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
