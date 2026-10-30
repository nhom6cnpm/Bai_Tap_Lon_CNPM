import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Dạng dòng giỏ dùng chung với Task 6
export type ProductSize = "S" | "M" | "L";
export interface CartItem {
  productId: string;
  name: string;
  imageUrl: string;
  size: ProductSize;
  toppingIds: string[];
  qty: number;
  unitPrice: number; // đã gồm size + topping, tính bằng calculateUnitPrice
}

// Khóa nhận diện "cùng món + cùng size + cùng topping" (không phụ thuộc thứ tự topping)
export function getLineKey(
  item: Pick<CartItem, "productId" | "size" | "toppingIds">,
): string {
  return `${item.productId}|${item.size}|${[...item.toppingIds].sort().join(",")}`;
}

export interface CartState {
  items: CartItem[];
  voucherCode: string;
  setVoucherCode: (code: string) => void;
  addItem: (item: CartItem) => void;
  setQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      voucherCode: "",
      setVoucherCode: (code) => set({ voucherCode: code.trim().toUpperCase() }),

      addItem: (item) =>
        set((state) => {
          const normalized: CartItem = {
            ...item,
            toppingIds: [...item.toppingIds].sort(),
          };
          const key = getLineKey(normalized);
          const exists = state.items.some((i) => getLineKey(i) === key);
          if (exists) {
            // Trùng món + size + topping thì cộng dồn số lượng
            return {
              items: state.items.map((i) =>
                getLineKey(i) === key
                  ? { ...i, qty: i.qty + normalized.qty }
                  : i,
              ),
            };
          }
          return { items: [...state.items, normalized] };
        }),

      setQty: (key, qty) =>
        set((state) => ({
          items: state.items.map((i) =>
            getLineKey(i) === key
              ? { ...i, qty: Math.max(1, Math.min(99, qty)) }
              : i,
          ),
        })),

      removeItem: (key) =>
        set((state) => ({
          items: state.items.filter((i) => getLineKey(i) !== key),
        })),

      clear: () => set({ items: [], voucherCode: "" }),
    }),
    {
      name: "brewlite-cart", // khóa trong localStorage
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        voucherCode: state.voucherCode,
      }),
    },
  ),
);

// Selector tổng số ly / tổng tiền
export const selectTotalQty = (s: CartState) =>
  s.items.reduce((n, i) => n + i.qty, 0);
export const selectTotalPrice = (s: CartState) =>
  s.items.reduce((n, i) => n + i.unitPrice * i.qty, 0);
