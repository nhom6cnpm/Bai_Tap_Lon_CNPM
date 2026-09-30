'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import styles from './productDetail.module.css';

// Sample prices: agree on these with the team before connecting the API.
const product = {
  id: '1',
  name: 'Cappuccino',
  description: 'Cà phê espresso đậm đà, hòa cùng sữa tươi và lớp bọt sữa mềm mịn.',
  price: 45000,
  imageUrl: '/products/cappuccino.jpg',
};
const sizes = [
  { id: 'S', label: 'Chuẩn', price: 0 },
  { id: 'M', label: '+5.000đ', price: 5000 },
  { id: 'L', label: '+10.000đ', price: 10000 },
] as const;
type Size = (typeof sizes)[number]['id'];
const toppings = [
  { id: 'cream', name: 'Kem béo', price: 5000 },
  { id: 'pearls', name: 'Trân châu hoàng kim', price: 5000 },
];
type Selection = {
  productId: string;
  name: string;
  size: Size;
  toppingIds: string[];
  quantity: number;
  unitPrice: number;
};
const formatPrice = (value: number) => `${value.toLocaleString('vi-VN')}đ`;

function CupIcon({ small = false }: { small?: boolean }) {
  return (
    <svg width={small ? 18 : 24} height={small ? 18 : 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M5 8h12v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8Z" />
      <path d="M17 9h2a3 3 0 0 1 0 6h-2M8 2v3M12 2v3M16 2v3" />
    </svg>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [size, setSize] = useState<Size>('S');
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  // Temporary local selections. Replace this handoff with the Task 5 cart store.
  const [selections, setSelections] = useState<Selection[]>([]);
  const [message, setMessage] = useState('');

  const sizePrice = sizes.find((item) => item.id === size)?.price ?? 0;
  const toppingPrice = toppings.filter((item) => selectedToppings.includes(item.id))
    .reduce((total, item) => total + item.price, 0);
  const unitPrice = product.price + sizePrice + toppingPrice;
  const totalPrice = unitPrice * quantity;
  const cartCount = selections.reduce((total, item) => total + item.quantity, 0);

  function toggleTopping(toppingId: string) {
    setSelectedToppings((previous) => previous.includes(toppingId)
      ? previous.filter((item) => item !== toppingId)
      : [...previous, toppingId]);
    setMessage('');
  }

  function addSelection() {
    const selection: Selection = {
      productId: product.id, name: product.name, size,
      toppingIds: [...selectedToppings], quantity, unitPrice,
    };
    setSelections((previous) => [...previous, selection]);
    setMessage(`Đã thêm ${quantity} ly ${product.name} size ${size} · ${formatPrice(totalPrice)}.`);
  }

  return (
    <div className={styles.page} lang="vi">
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} href="/" aria-label="BrewLite — Trang chủ">
            <span className={styles.logo}><CupIcon /></span>
            <span><span className={styles.brandName}>Brew<span>Lite</span><small>SGU</small></span>
              <span className={styles.brandDescription}>Đồ án Công nghệ phần mềm · Đại học Sài Gòn</span>
            </span>
          </Link>
          <nav className={styles.nav} aria-label="Điều hướng">
            <Link href="/">Trang chủ</Link>
            <Link className={styles.activeNav} href="/products/1" aria-current="page">Chi tiết món</Link>
            <span className={styles.cartLabel}>Giỏ hàng <span>{cartCount}</span></span>
          </nav>
          <span className={styles.pickup}><span />Nhận đồ uống tại quầy</span>
        </div>
      </header>

      <main className={styles.main}>
        <Link href="/" className={styles.backLink}>← Quay lại trang chủ</Link>
        {id !== product.id ? (
          <section className={styles.missing}>
            <h1>Chưa có thông tin món này</h1>
            <p>Vui lòng chọn một món khác.</p>
            <Link href="/products/1">Xem Cappuccino →</Link>
          </section>
        ) : (
          <section className={styles.card} aria-labelledby="product-name">
            <div className={styles.photo}>
              <Image src={product.imageUrl} alt="Ly Cappuccino với lớp bọt sữa hình chiếc lá" fill preload sizes="(max-width: 760px) 100vw, 42vw" />
              <span className={styles.photoBadge}>Món đặc trưng</span>
            </div>
            <div className={styles.content}>
              <div className={styles.productHeading}>
                <div><h1 id="product-name">{product.name}</h1><p>{product.description}</p></div>
                <div className={styles.basePrice}><span>Giá gốc</span><strong>{formatPrice(product.price)}</strong></div>
              </div>

              <fieldset className={styles.options}>
                <legend>Chọn kích cỡ <span>(Size)</span></legend>
                <div className={styles.sizeGrid}>
                  {sizes.map((item) => (
                    <label key={item.id} className={`${styles.sizeOption} ${size === item.id ? styles.selectedSize : ''}`}>
                      <input type="radio" name="size" value={item.id} checked={size === item.id}
                        onChange={() => { setSize(item.id); setMessage(''); }} />
                      <strong>Size {item.id}</strong><span>{item.label}{item.price === 0 ? ' (0đ)' : ''}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className={styles.options}>
                <legend>Topping thêm <span>(+5.000đ / loại)</span></legend>
                <div className={styles.toppingList}>
                  {toppings.map((item) => (
                    <label key={item.id} className={`${styles.toppingOption} ${selectedToppings.includes(item.id) ? styles.selectedTopping : ''}`}>
                      <input type="checkbox" checked={selectedToppings.includes(item.id)} onChange={() => toggleTopping(item.id)} />
                      <span>{item.name}</span><strong>+{formatPrice(item.price)}</strong>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className={styles.quantityRow}>
                <span>Số lượng ly</span>
                <div className={styles.stepper}>
                  <button type="button" aria-label="Giảm số lượng" disabled={quantity === 1}
                    onClick={() => { setQuantity((value) => Math.max(1, value - 1)); setMessage(''); }}>−</button>
                  <output aria-label="Số lượng">{quantity}</output>
                  <button type="button" aria-label="Tăng số lượng"
                    onClick={() => { setQuantity((value) => value + 1); setMessage(''); }}>+</button>
                </div>
              </div>

              <div className={styles.summary} aria-live="polite" aria-atomic="true">
                <span>Đơn giá 1 ly: <strong>{formatPrice(unitPrice)}</strong></span>
                <span>Thành tiền: <strong className={styles.total}>{formatPrice(totalPrice)}</strong></span>
              </div>
              <button className={styles.addButton} type="button" onClick={addSelection}>
                <CupIcon small />Thêm vào giỏ hàng · {formatPrice(totalPrice)}
              </button>
              <div className={styles.feedback} role="status">{message}</div>
            </div>
          </section>
        )}
      </main>
      <footer className={styles.footer}>
        <span><strong>BrewLite © 2026</strong> · Đồ án Công nghệ phần mềm · Đại học Sài Gòn</span>
        <span>Nhận đồ uống tại quầy</span>
      </footer>
    </div>
  );
}
