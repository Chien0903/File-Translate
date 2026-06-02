import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/**
 * Custom hook for accessing auth state.
 *
 * Usage:
 *   const { role, fullName, email, authenticated, loading, refreshAuth, updateRole } = useAuth();
 */
export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }

    return context;
};
