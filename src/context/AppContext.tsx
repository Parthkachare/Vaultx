import { createContext, useCallback, useContext, useReducer, useState, type ReactNode } from "react";
import type { ApiNotification, ApiPaper, ApiUser } from "../services/api";
import { apiRequest } from "../services/api";
import type { Paper, AppUser, AuditEntry, SecurityAlert, PaperStatus } from "../data/mockData";

export interface Notification {
  id: string | number;
  type: string;
  iconName: string;
  color: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

interface State {
  papers: Paper[];
  users: AppUser[];
  auditLogs: AuditEntry[];
  securityAlerts: SecurityAlert[];
  notifications: Notification[];
}

type Action =
  | { type: "ADD_PAPER"; paper: Paper }
  | { type: "UPDATE_PAPER"; paperId: string; changes: Partial<Paper> }
  | { type: "APPROVE_PAPER"; paperId: string; manager: 1 | 2; approverName: string; approvedAt: string }
  | { type: "SET_PAPER_STATUS"; paperId: string; status: PaperStatus }
  | { type: "ADD_USER"; user: AppUser }
  | { type: "TOGGLE_USER_STATUS"; userId: string }
  | { type: "REMOVE_USER"; userId: string }
  | { type: "ADD_AUDIT"; entry: AuditEntry }
  | { type: "RESOLVE_ALERT"; alertId: string }
  | { type: "ADD_ALERT"; alert: SecurityAlert }
  | { type: "MARK_NOTIF_READ"; id: string | number }
  | { type: "MARK_ALL_READ" }
  | { type: "ADD_NOTIF"; notif: Notification }
  | { type: "LOAD_STATE"; state: State };

const initialState: State = {
  papers: [],
  users: [],
  auditLogs: [],
  securityAlerts: [],
  notifications: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD_STATE":
      return action.state;
    case "ADD_PAPER":
      return { ...state, papers: [action.paper, ...state.papers] };
    case "UPDATE_PAPER":
      return { ...state, papers: state.papers.map(paper => paper.id === action.paperId ? { ...paper, ...action.changes } : paper) };
    case "APPROVE_PAPER":
      return {
        ...state,
        papers: state.papers.map(paper => {
          if (paper.id !== action.paperId) return paper;
          const updated = action.manager === 1
            ? { ...paper, manager1Approved: true, manager1ApprovedAt: action.approvedAt }
            : { ...paper, manager2Approved: true, manager2ApprovedAt: action.approvedAt };
          return { ...updated, status: updated.manager1Approved && updated.manager2Approved ? "APPROVED" : "AWAITING_APPROVAL" };
        }),
      };
    case "SET_PAPER_STATUS":
      return { ...state, papers: state.papers.map(paper => paper.id === action.paperId ? { ...paper, status: action.status } : paper) };
    case "ADD_USER":
      return { ...state, users: [...state.users, action.user] };
    case "TOGGLE_USER_STATUS":
      return { ...state, users: state.users.map(user => user.id === action.userId ? { ...user, status: user.status === "Active" ? "Inactive" : "Active" } : user) };
    case "REMOVE_USER":
      return { ...state, users: state.users.filter(user => user.id !== action.userId) };
    case "ADD_AUDIT":
      return { ...state, auditLogs: [action.entry, ...state.auditLogs] };
    case "RESOLVE_ALERT":
      return { ...state, securityAlerts: state.securityAlerts.map(alert => alert.id === action.alertId ? { ...alert, resolved: true } : alert) };
    case "ADD_ALERT":
      return { ...state, securityAlerts: [action.alert, ...state.securityAlerts] };
    case "MARK_NOTIF_READ":
      return { ...state, notifications: state.notifications.map(notification => notification.id === action.id ? { ...notification, unread: false } : notification) };
    case "MARK_ALL_READ":
      return { ...state, notifications: state.notifications.map(notification => ({ ...notification, unread: false })) };
    case "ADD_NOTIF":
      return { ...state, notifications: [action.notif, ...state.notifications] };
    default:
      return state;
  }
}

function displayTime(value?: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function personName(value: ApiPaper["manager1"] | ApiPaper["uploadedBy"]): string {
  return typeof value === "string" ? value : value.name;
}

export function mapPaper(value: ApiPaper): Paper {
  return {
    id: value.paperId,
    examName: value.examName,
    subject: value.subject,
    course: value.course,
    examDate: value.examDate,
    startTime: value.examStartTime,
    unlockTime: value.unlockTime,
    expiryTime: value.expiryTime,
    status: value.status,
    manager1: personName(value.manager1),
    manager2: personName(value.manager2),
    manager1Id: typeof value.manager1 === "string" ? value.manager1 : value.manager1._id,
    manager2Id: typeof value.manager2 === "string" ? value.manager2 : value.manager2._id,
    manager1Approved: value.manager1Approved,
    manager2Approved: value.manager2Approved,
    manager1ApprovedAt: displayTime(value.manager1ApprovedAt),
    manager2ApprovedAt: displayTime(value.manager2ApprovedAt),
    securityLevel: value.securityLevel,
    encryptionId: value.encryptionId ?? "—",
    uploadedBy: personName(value.uploadedBy),
    uploadedAt: displayTime(value.createdAt) ?? value.createdAt,
  };
}

function mapUser(user: ApiUser & Partial<AppUser>): AppUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as AppUser["role"],
    department: user.department ?? "",
    status: user.status ?? "Active",
    lastActive: user.lastActive ?? "Never",
  };
}

function mapNotification(notification: ApiNotification): Notification {
  const icons: Record<string, [string, string]> = {
    approval: ["Shield", "text-blue-400 bg-blue-500/10 border-blue-500/20"],
    upload: ["Upload", "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"],
    security: ["AlertTriangle", "text-red-400 bg-red-500/10 border-red-500/20"],
    approved: ["CheckCircle", "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"],
    unlock: ["Lock", "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"],
  };
  const [iconName, color] = icons[notification.type] ?? ["Bell", "text-slate-400 bg-slate-500/10 border-slate-500/20"];
  return {
    id: notification._id,
    type: notification.type,
    iconName,
    color,
    title: notification.title,
    message: notification.message,
    time: displayTime(notification.createdAt) ?? notification.createdAt,
    unread: !notification.isRead,
  };
}

function mapAudit(log: Record<string, unknown>): AuditEntry {
  const timestamp = String(log.timestamp ?? "");
  const date = new Date(timestamp);
  return {
    id: String(log._id ?? ""),
    time: Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString(),
    user: String(log.userName || log.userEmail || "System"),
    role: String(log.role || "System"),
    action: String(log.action || ""),
    ip: String(log.ipAddress || ""),
    device: String(log.userAgent || ""),
    status: log.status as AuditEntry["status"],
    paperId: log.paperId ? String(log.paperId) : undefined,
  };
}

function mapSecurityEvent(event: Record<string, unknown>): SecurityAlert {
  const timestamp = String(event.timestamp ?? "");
  const date = new Date(timestamp);
  return {
    id: String(event._id ?? ""),
    type: String(event.eventType ?? "Security event").replace(/_/g, " "),
    message: String(event.description ?? ""),
    severity: event.riskLevel as SecurityAlert["severity"],
    time: Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString(),
    resolved: Boolean(event.resolved),
  };
}

interface AppContextValue extends State {
  dispatch: React.Dispatch<Action>;
  loading: boolean;
  loadError: string;
  refreshData: (role: string) => Promise<void>;
  addAudit: (entry: Omit<AuditEntry, "id">) => void;
  addNotif: (notif: Omit<Notification, "id">) => void;
  addAlert: (alert: Omit<SecurityAlert, "id">) => void;
  nowTimestamp: () => string;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const refreshData = useCallback(async (role: string) => {
    setLoading(true);
    setLoadError("");
    try {
      const isAdmin = role === "Admin";
      const [rawPapers, rawUsers, rawNotifications, auditResult, rawEvents] = await Promise.all([
        apiRequest<ApiPaper[]>("/papers"),
        apiRequest<Array<ApiUser & Partial<AppUser>>>(isAdmin ? "/users" : "/users/approvers"),
        apiRequest<ApiNotification[]>("/notifications"),
        role === "Admin" || role === "Exam Controller"
          ? apiRequest<{ logs: Record<string, unknown>[] }>("/audit/logs?limit=500")
          : Promise.resolve({ logs: [] }),
        isAdmin ? apiRequest<Record<string, unknown>[]>("/audit/security-events") : Promise.resolve([]),
      ]);
      dispatch({
        type: "LOAD_STATE",
        state: {
          papers: rawPapers.map(mapPaper),
          users: rawUsers.map(mapUser),
          auditLogs: auditResult.logs.map(mapAudit),
          securityAlerts: rawEvents.map(mapSecurityEvent),
          notifications: rawNotifications.map(mapNotification),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load VaultX data.";
      setLoadError(message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const nowTimestamp = () => new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const addAudit = (entry: Omit<AuditEntry, "id">) => dispatch({ type: "ADD_AUDIT", entry: { ...entry, id: `local-${Date.now()}` } });
  const addNotif = (notif: Omit<Notification, "id">) => dispatch({ type: "ADD_NOTIF", notif: { ...notif, id: `local-${Date.now()}` } });
  const addAlert = (alert: Omit<SecurityAlert, "id">) => dispatch({ type: "ADD_ALERT", alert: { ...alert, id: `local-${Date.now()}` } });

  return (
    <AppContext.Provider value={{ ...state, dispatch, loading, loadError, refreshData, addAudit, addNotif, addAlert, nowTimestamp }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
