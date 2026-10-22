import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function OrderShell({
  children,
  demo = false,
}: {
  children: ReactNode;
  demo?: boolean;
}) {
  return (
    <div className="order-app">
      <a className="skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="BrewLite — Trang chủ">
            <span className="brand-mark">
              <Icon name="cup" size={25} />
            </span>
            BrewLite
          </Link>
          <span className="campus-label">
            Đồ án Công nghệ phần mềm · Đại học Sài Gòn
          </span>
          <nav aria-label="Điều hướng chính">
            <Link href="/">Trang chủ</Link>
            <Link aria-current="page" href={demo ? "/demo/orders" : "/orders"}>
              Đơn hàng
            </Link>
          </nav>
          <span className="counter-label">
            <i />
            Nhận tại quầy
          </span>
          <Link className="account-button" href="/login" aria-label="Tài khoản">
            <Icon name="user" size={18} />
          </Link>
        </div>
      </header>
      {demo && (
        <div className="demo-banner">
          Bạn đang xem dữ liệu mẫu <span>·</span>{" "}
          <Link href="/orders">
            Xem đơn hàng của tôi <Icon name="arrow" size={13} />
          </Link>
        </div>
      )}
      <main id="main-content" className="order-main">
        {children}
      </main>
      <footer className="site-footer">
        <span>
          BrewLite © 2026 · Đồ án Công nghệ phần mềm · Đại học Sài Gòn
        </span>
        <span>Đặt cà phê, nhận tại quầy.</span>
      </footer>
    </div>
  );
}
