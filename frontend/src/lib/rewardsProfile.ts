import {
  clearAuth,
  getStoredToken,
  getStoredUser,
  getStoredUserRaw,
  saveAuth,
  type UserProfile,
} from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/products";

/** Refresh only the session that requested the profile; never overwrite a newer login. */
export async function refreshRewardsProfile(
  token: string,
  signal?: AbortSignal,
): Promise<UserProfile> {
  const owner = getStoredUser()?.id;
  const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    if (response.status === 401 && getStoredToken() === token) clearAuth();
    throw new Error(
      response.status === 401
        ? "Phiên đăng nhập đã hết hạn."
        : "Chưa cập nhật được điểm thưởng.",
    );
  }
  const value: unknown = await response.json();
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !value.id ||
    !("email" in value) ||
    typeof value.email !== "string" ||
    !value.email ||
    !("loyaltyPoints" in value) ||
    typeof value.loyaltyPoints !== "number" ||
    !Number.isSafeInteger(value.loyaltyPoints) ||
    value.loyaltyPoints < 0 ||
    ("role" in value && value.role !== "CUSTOMER" && value.role !== "ADMIN")
  )
    throw new Error("Thông tin điểm thưởng chưa hợp lệ.");
  const profile: UserProfile = {
    id: value.id,
    email: value.email,
    loyaltyPoints: value.loyaltyPoints,
    ...("role" in value && (value.role === "CUSTOMER" || value.role === "ADMIN")
      ? { role: value.role }
      : {}),
  };
  if (
    signal?.aborted ||
    getStoredToken() !== token ||
    (owner && (profile.id !== owner || getStoredUser()?.id !== owner))
  )
    throw new DOMException("Phiên đăng nhập đã thay đổi.", "AbortError");
  if (getStoredUserRaw() !== JSON.stringify(profile)) saveAuth(token, profile);
  return profile;
}
