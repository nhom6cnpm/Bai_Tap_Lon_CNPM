"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { ACCESS_TOKEN_KEY, apiRequest } from "@/lib/api";
import { OrderShell } from "./OrderShell";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = JSON.stringify({
      email: form.get("email"),
      password: form.get("password"),
    });
    try {
      if (register)
        await apiRequest("/auth/register", { method: "POST", body });
      const result = await apiRequest<{ access_token: string }>("/auth/login", {
        method: "POST",
        body,
      });
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, result.access_token);
      router.replace(
        next.startsWith("/orders") && !next.includes("\\") ? next : "/orders",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đăng nhập.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <OrderShell>
      <section className="panel login-panel">
        <p className="eyebrow">CHÀO MỪNG ĐẾN BREWLITE</p>
        <h1>{register ? "Tạo tài khoản" : "Hẹn bạn một ly cà phê."}</h1>
        <p className="muted">
          Đăng nhập để theo dõi và xem lại đơn hàng của bạn.
        </p>
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="ban@example.com"
          />
          <label htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={register ? 6 : undefined}
            autoComplete={register ? "new-password" : "current-password"}
          />
          <p role="alert" className="form-error">
            {error}
          </p>
          <button className="button button-primary full-width" disabled={busy}>
            {busy
              ? "Đang xử lý…"
              : register
                ? "Đăng ký và đăng nhập"
                : "Đăng nhập"}
          </button>
        </form>
        <button
          className="button button-quiet full-width"
          disabled={busy}
          onClick={() => {
            setRegister(!register);
            setError("");
          }}
        >
          {register
            ? "Đã có tài khoản? Đăng nhập"
            : "Chưa có tài khoản? Đăng ký"}
        </button>
        <Link className="demo-entry" href="/demo/orders">
          Xem thử giao diện với dữ liệu mẫu →
        </Link>
      </section>
    </OrderShell>
  );
}
