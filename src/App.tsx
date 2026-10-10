import { useEffect, useState } from "react";
import { useApp } from "./context/AppContext";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import ExamControllerDashboard from "./pages/ExamControllerDashboard";
import ManagerDashboard from "./pages/ManagerDashboard";
import VaultPage from "./pages/VaultPage";
import UploadPaperPage from "./pages/UploadPaperPage";
import EncryptionProcessPage from "./pages/EncryptionProcessPage";
import PaperDetailsPage from "./pages/PaperDetailsPage";
import DualAuthPage from "./pages/DualAuthPage";
import TimeLockPage from "./pages/TimeLockPage";
import UnlockPage from "./pages/UnlockPage";
import SecureViewerPage from "./pages/SecureViewerPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import SecurityMonitorPage from "./pages/SecurityMonitorPage";
import UserManagementPage from "./pages/UserManagementPage";
import ExamManagementPage from "./pages/ExamManagementPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import * as authService from "./services/auth";
import { AUTH_TOKEN_STORAGE_KEY, getToken } from "./services/api";

type Page =
  | "dashboard" | "vault" | "exams" | "approvals" | "secure-vault"
  | "audit" | "security" | "users" | "notifications" | "settings"
  | "upload" | "encryption" | "paper-details" | "dual-auth"
  | "timelock" | "unlock" | "viewer";

export default function App() {
  const { notifications, securityAlerts, refreshData, loadError } = useApp();
  const [currentUser, setCurrentUser] = useState<authService.AuthUser | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [activePaperId, setActivePaperId] = useState("");
  const [navigationNotice, setNavigationNotice] = useState("");
  const [restoring, setRestoring] = useState(true);
  const [authError, setAuthError] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");

  useEffect(() => {
    let active = true;
    let restoreGeneration = 0;
    const restoreSession = () => {
      const token = getToken();
      const generation = ++restoreGeneration;
      setRestoring(true);
      authService.getCurrentUser()
        .then(user => {
          if (active && generation === restoreGeneration && getToken() === token) {
            setCurrentUser(user);
            setAuthError("");
          }
        })
        .catch(error => {
          if (active && generation === restoreGeneration && getToken() === token) {
            setCurrentUser(null);
            setAuthError(error instanceof Error ? error.message : "Could not restore the server session.");
          }
        })
        .finally(() => {
          if (active && generation === restoreGeneration && getToken() === token) setRestoring(false);
        });
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== null && event.key !== AUTH_TOKEN_STORAGE_KEY) return;
      setCurrentUser(null);
      restoreSession();
    };

    restoreSession();
    window.addEventListener("storage", handleStorageChange);
    return () => {
      active = false;
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    refreshData(currentUser.role).catch(() => {
      // refreshData stores and displays the error in the application shell.
    });
  }, [currentUser, refreshData]);

  const navigate = (page: string, extra?: string, notice = "") => {
    setCurrentPage(page as Page);
    if (extra) setActivePaperId(extra);
    setNavigationNotice(notice);
  };

  const handleLogin = (user: authService.AuthUser) => {
    setAuthError("");
    setCurrentUser(user);
    setCurrentPage("dashboard");
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      setAuthError("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "The server could not revoke this session.");
    } finally {
      setCurrentUser(null);
      setCurrentPage("dashboard");
      setActivePaperId("");
    }
  };

  if (restoring) {
    return <div className="h-screen flex items-center justify-center bg-[#0b0b11] text-sm text-slate-500">Validating secure session…</div>;
  }
  if (!currentUser) return <LoginPage onLogin={handleLogin} startupError={authError} />;

  const userRole = currentUser.role;
  const userName = currentUser.name;
  const unreadCount = notifications.filter(notification => notification.unread).length;
  const activeAlertCount = securityAlerts.filter(alert => !alert.resolved).length;

  if (currentPage === "viewer") {
    return (
      <div className="h-screen overflow-hidden" style={{ background: "#0b0b11" }}>
        <SecureViewerPage navigate={navigate} paperId={activePaperId} userName={userName} />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex" style={{ background: "#0b0b11", color: "#c8c8dc" }}>
      <Sidebar currentPage={currentPage} navigate={navigate} role={userRole} alertCount={activeAlertCount} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          userName={userName}
          role={userRole}
          navigate={navigate}
          notifCount={unreadCount}
          onLogout={handleLogout}
          onSearch={query => { setGlobalSearch(query); navigate("vault"); }}
        />
        {(loadError || authError) && (
          <div role="alert" className="mx-5 mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
            {loadError || authError}
          </div>
        )}
        <main className="flex-1 overflow-hidden">
          {currentPage === "dashboard" && (
            userRole === "Exam Controller"
              ? <ExamControllerDashboard navigate={navigate} userName={userName} />
              : userRole === "Admin"
                ? <AdminDashboard navigate={navigate} />
                : <ManagerDashboard navigate={navigate} role={userRole} userId={currentUser.id} userName={userName} />
          )}
          {(currentPage === "vault" || currentPage === "secure-vault") && <VaultPage navigate={navigate} initialSearch={globalSearch} />}
          {currentPage === "exams" && <ExamManagementPage navigate={navigate} />}
          {(currentPage === "approvals" || currentPage === "dual-auth") && <DualAuthPage navigate={navigate} paperId={currentPage === "approvals" ? "" : activePaperId} role={userRole} userName={userName} currentUserId={currentUser.id} />}
          {currentPage === "audit" && <AuditLogsPage />}
          {currentPage === "security" && <SecurityMonitorPage />}
          {currentPage === "users" && <UserManagementPage currentUserId={currentUser.id} />}
          {currentPage === "notifications" && <NotificationsPage />}
          {currentPage === "settings" && <SettingsPage user={currentUser} onUserUpdated={setCurrentUser} />}
          {currentPage === "upload" && <UploadPaperPage navigate={navigate} userName={userName} userRole={userRole} />}
          {currentPage === "encryption" && <EncryptionProcessPage navigate={navigate} paperId={activePaperId} notice={navigationNotice} />}
          {currentPage === "paper-details" && <PaperDetailsPage navigate={navigate} paperId={activePaperId} role={userRole} />}
          {currentPage === "timelock" && <TimeLockPage navigate={navigate} paperId={activePaperId} />}
          {currentPage === "unlock" && <UnlockPage navigate={navigate} paperId={activePaperId} userName={userName} userRole={userRole} />}
        </main>
      </div>
    </div>
  );
}
