export const TOKEN_KEY = 'brewlite_token';
export const USER_KEY = 'brewlite_user';

export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  loyaltyPoints: number;
  role?: UserRole;
}

export interface AuthResponse {
  access_token: string;
  user: UserProfile;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', notifyListeners);
}

export function subscribeAuth(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUserRaw(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_KEY);
}

export function getStoredUser(): UserProfile | null {
  const userJson = getStoredUserRaw();
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as UserProfile;
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: UserProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyListeners();
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifyListeners();
}


export async function loginApi(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Email hoặc mật khẩu không chính xác.');
    }
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new Error(message || `Đăng nhập thất bại (mã lỗi ${res.status})`);
  }

  return data as AuthResponse;
}

export async function registerApi(email: string, password: string): Promise<UserProfile> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 409) {
      throw new Error('Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.');
    }
    const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
    throw new Error(message || `Đăng ký thất bại (mã lỗi ${res.status})`);
  }

  return data as UserProfile;
}

export async function getProfileApi(): Promise<UserProfile> {
  const token = getStoredToken();
  if (!token) throw new Error('Chưa đăng nhập');

  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearAuth();
    }
    throw new Error('Phiên đăng nhập đã hết hạn');
  }

  const profile = (await res.json()) as UserProfile;
  localStorage.setItem(USER_KEY, JSON.stringify(profile));
  return profile;
}
