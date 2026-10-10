export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  phone?: string;
  preferences?: Record<string, boolean>;
  notificationPreferences?: Record<string, boolean>;
}

export interface ApiPaper {
  _id: string;
  paperId: string;
  examName: string;
  subject: string;
  course: string;
  examDate: string;
  examStartTime: string;
  unlockTime: string;
  expiryTime: string;
  manager1: { _id: string; name: string; email: string; role: string } | string;
  manager2: { _id: string; name: string; email: string; role: string } | string;
  uploadedBy: { _id: string; name: string; email: string } | string;
  manager1Approved: boolean;
  manager2Approved: boolean;
  manager1ApprovedAt?: string | null;
  manager2ApprovedAt?: string | null;
  encryptionId?: string;
  originalFilename?: string;
  fileSizeBytes?: number;
  status: "LOCKED" | "AWAITING_APPROVAL" | "APPROVED" | "UNLOCKED" | "EXPIRED";
  securityLevel: "HIGH" | "CRITICAL";
  createdAt: string;
}

export interface ApiNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  paperId?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface Envelope<T> {
  success: true;
  data: T;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(status: number, message: string, requestId?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.requestId = requestId;
  }
}

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace(/\/$/, "");
export const AUTH_TOKEN_STORAGE_KEY = "vaultx_jwt";

export function getToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function storeToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

async function decodeError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error || `Request failed (${response.status}).`;
  } catch {
    return `Request failed (${response.status}).`;
  }
}

async function makeApiRequestError(response: Response): Promise<ApiRequestError> {
  return new ApiRequestError(
    response.status,
    await decodeError(response),
    response.headers.get("X-Request-ID") ?? undefined,
  );
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new Error("VaultX API is unavailable. Check the backend connection and try again.");
  }

  if (!response.ok) throw await makeApiRequestError(response);
  const envelope = await response.json() as Envelope<T>;
  if (!envelope || envelope.success !== true || !("data" in envelope)) {
    throw new Error("VaultX API returned an invalid response.");
  }
  return envelope.data;
}

export async function apiBlob(path: string): Promise<{ blob: Blob; headers: Headers }> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
  } catch {
    throw new Error("VaultX API is unavailable. Check the backend connection and try again.");
  }
  if (!response.ok) throw await makeApiRequestError(response);
  return { blob: await response.blob(), headers: response.headers };
}

export function toQuery(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
