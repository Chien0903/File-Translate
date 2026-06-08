import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { AuthProvider } from "../context/AuthContext";
import { useAuth } from "../hooks/useAuth";

import LoginPage from "../pages/login";
import HomePage from "../pages/home";
import NotFound from "../pages/error/notFound";
import MyProfile from "../pages/profile/index";
import AccountManagement from "../pages/Admin/AccountManagement";
import EditUserRole from "../components/features/admin/editUserRole";
import Layout from "../components/Layouts/layout";
import CommonLibraryManagement from "../pages/Admin/CommonLibraryManagement";
import FileHistory from "../pages/fileHistory";
import TranslationResults from "../pages/translationResults";
import FormatConversionPage from "../pages/formatConvertsion";
import ConversionResults from "../pages/conversionResults";
import PrivateLibrary from "../pages/privateLibrary/index";
import TextTranslation from "../pages/textTranslation";
import KeywordStatsAdmin from "../pages/Admin/KeywordStatsAdmin";

/** Redirect unauthenticated users to /login */
function ProtectedRoute({ children }) {
  const { authenticated, loading } = useAuth();
  if (loading) return null;
  if (!authenticated) return <Navigate to="/login" replace />;
  return children;
}

/** Calls authService logout then redirects */
function Logout() {
  const { logout } = useAuth();
  useEffect(() => {
    logout();
  }, [logout]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected — everything under Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="/text-translation" element={<TextTranslation />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/my-profile" element={<MyProfile />} />
            <Route path="/admin/edit-user/:id" element={<EditUserRole />} />
            <Route path="/admin" element={<AccountManagement />} />
            <Route path="/admin/keyword-stats" element={<KeywordStatsAdmin />} />
            <Route path="/translation-results" element={<TranslationResults />} />
            <Route path="/file-format-conversion" element={<FormatConversionPage />} />
            <Route path="/conversion-results" element={<ConversionResults />} />
            <Route path="/common-library" element={<CommonLibraryManagement />} />
            <Route path="/file-history" element={<FileHistory />} />
            <Route path="/private-library" element={<PrivateLibrary />} />
            <Route
              path="/suggestion-review"
              element={<Navigate to="/common-library" replace />}
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>

        <ToastContainer
          position="top-right"
          autoClose={3000}
          newestOnTop
          theme="colored"
          style={{ zIndex: 99999 }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
