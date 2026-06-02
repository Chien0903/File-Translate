import { createContext, useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import albAuthService from "../services/albAuthService";

/**
 * Centralized authentication context.
 * Replaces scattered localStorage reads and duplicate auth init logic
 * previously in ALBAuthCheck.jsx and layout.jsx.
 */
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [authState, setAuthState] = useState({
        authenticated: false,
        loading: true,
        user: null,
        fullName: "",
        email: "",
        role: "",
        permissions: {},
        provider: "",
    });

    // Initialize authentication once on mount
    useEffect(() => {
        let mounted = true;

        const initialize = async () => {
            try {
                const result = await albAuthService.initializeAuth();

                if (mounted) {
                    if (result.authenticated && result.user) {
                        const user = result.user;
                        const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();

                        setAuthState({
                            authenticated: true,
                            loading: false,
                            user: result.user,
                            fullName,
                            email: user.email ?? "",
                            role: user.role ?? "",
                            permissions: result.permissions ?? {},
                            provider: result.provider || "alb_cognito",
                        });
                    } else {
                        setAuthState((prev) => ({
                            ...prev,
                            loading: false,
                            authenticated: false,
                        }));
                    }
                }
            } catch (error) {
                console.error("Authentication initialization failed:", error);
                if (mounted) {
                    setAuthState((prev) => ({
                        ...prev,
                        loading: false,
                        authenticated: false,
                    }));
                }
            }
        };

        initialize();

        return () => {
            mounted = false;
        };
    }, []);

    /**
     * Refresh auth state from server (e.g. after role change).
     * Also updates localStorage for backward compatibility.
     */
    const refreshAuth = useCallback(async () => {
        try {
            const status = await albAuthService.checkALBAuth();

            if (status?.authenticated && status.user) {
                const user = status.user;
                const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();

                // Update localStorage for backward compatibility
                localStorage.setItem("fullName", fullName);
                localStorage.setItem("email", user.email ?? "");
                localStorage.setItem("role", user.role ?? "");
                localStorage.setItem("auth_provider", status.provider || "alb_cognito");

                setAuthState({
                    authenticated: true,
                    loading: false,
                    user: status.user,
                    fullName,
                    email: user.email ?? "",
                    role: user.role ?? "",
                    permissions: status.permissions ?? {},
                    provider: status.provider || "alb_cognito",
                });

                // Dispatch storage event for any remaining components listening
                window.dispatchEvent(new Event("storage"));
            }
        } catch (error) {
            console.error("Auth refresh failed:", error);
        }
    }, []);

    /**
     * Update role locally (e.g. after admin changes user's role).
     */
    const updateRole = useCallback((newRole) => {
        localStorage.setItem("role", newRole);
        setAuthState((prev) => ({ ...prev, role: newRole }));
        window.dispatchEvent(new Event("storage"));
    }, []);

    const contextValue = {
        ...authState,
        refreshAuth,
        updateRole,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired,
};
