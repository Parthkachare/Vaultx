import { apiRequest, clearToken, getToken, storeToken, type ApiUser } from "./api";

export type AuthUser = ApiUser;

interface OtpChallenge {
  message: string;
  _devOtp?: string;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<OtpChallenge> {
  return apiRequest<OtpChallenge>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyOtp(email: string, otp: string): Promise<AuthUser> {
  const response = await apiRequest<LoginResponse>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, otp }),
  });
  storeToken(response.token);
  return response.user;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!getToken()) return null;
  const response = await apiRequest<{ user: AuthUser }>("/auth/me");
  return response.user;
}

export async function logout(): Promise<void> {
  try {
    if (getToken()) await apiRequest<{ message: string }>("/auth/logout", { method: "POST" });
  } finally {
    clearToken();
  }
}
