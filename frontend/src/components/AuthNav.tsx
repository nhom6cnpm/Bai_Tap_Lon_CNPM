"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useRewardsProfile } from "@/hooks/useRewardsProfile";

export default function AuthNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const rewards = useRewardsProfile();

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        {user.role === "ADMIN" && (
          <Link
            href="/admin/payments"
            className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900 transition hover:bg-sky-200"
          >
            Quản trị
          </Link>
        )}
        <div className="flex flex-col items-end text-xs">
          <span className="max-w-[130px] truncate font-medium text-stone-800 sm:max-w-[180px]">
            {user.email}
          </span>
          <span
            aria-label="Số dư điểm thưởng"
            title={
              rewards.isError
                ? "Chưa cập nhật được điểm thưởng"
                : "Điểm tích lũy BrewLite"
            }
            className="text-[11px] font-semibold text-amber-700"
          >
            ⭐ {user.loyaltyPoints ?? 0} điểm
            {rewards.isError && (
              <button
                type="button"
                aria-label="Thử cập nhật điểm"
                onClick={() => void rewards.refetch()}
                className="ml-1 underline"
              >
                ↻
              </button>
            )}
          </span>
        </div>
        <button
          onClick={logout}
          className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
        >
          Đăng xuất
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/login"
        className="rounded-full bg-amber-800 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-900"
      >
        Đăng nhập
      </Link>
    </div>
  );
}
