"use client";

import { useQuery } from "@tanstack/react-query";
import AdminGate from "@/components/admin/AdminGate";
import AdminNav from "@/components/admin/AdminNav";
import { getInventoryOverview } from "@/lib/admin/inventory";

// Refresh often so staff see stock go down / come back during a demo
const POLL_INTERVAL_MS = 5000;

const amount = (value: number, unit: string) =>
  `${value.toLocaleString("vi-VN")} ${unit}`;

export default function AdminIngredientsPage() {
  return (
    <AdminGate redirect="/admin/ingredients">
      {(token) => <IngredientBoard key={token} token={token} />}
    </AdminGate>
  );
}

function IngredientBoard({ token }: { token: string }) {
  const query = useQuery({
    queryKey: ["admin-ingredients", token],
    queryFn: ({ signal }) => getInventoryOverview(token, signal),
    refetchInterval: POLL_INTERVAL_MS,
    retry: false,
  });
  const data = query.data;
  const nameOf = new Map(data?.ingredients.map((row) => [row.id, row.name]));
  const lowCount = data?.ingredients.filter((row) => row.low).length ?? 0;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8">
      <AdminNav />
      <h1 className="text-2xl font-bold">Nguyên liệu</h1>
      <p className="mt-1 text-sm text-stone-600">
        Tự làm mới mỗi {POLL_INTERVAL_MS / 1000} giây · Số lượng trong kho đã
        trừ phần giữ cho đơn · Cảnh báo khi chỉ đủ dưới{" "}
        {data?.lowStockCups ?? 10} ly
        {lowCount > 0 && (
          <strong className="text-red-700">
            {" "}
            · {lowCount} nguyên liệu sắp hết
          </strong>
        )}
      </p>

      {query.isPending ? (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-stone-200 p-8 text-center text-stone-600"
        >
          Đang tải bảng nguyên liệu…
        </p>
      ) : query.isError ? (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-red-200 p-8 text-center"
        >
          <p className="font-semibold text-red-800">{query.error.message}</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-3 font-semibold text-amber-800 underline"
          >
            Thử lại
          </button>
        </div>
      ) : !data?.ingredients.length ? (
        <p className="mt-6 rounded-2xl border border-stone-200 p-8 text-center text-stone-600">
          Chưa có nguyên liệu nào.
        </p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <caption className="sr-only">Bảng nguyên liệu</caption>
              <thead className="bg-stone-50 text-stone-600">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Nguyên liệu
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Còn trong kho
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Đang giữ cho đơn chờ thanh toán
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Đủ cho
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Dùng cho
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {data.ingredients.map((row) => (
                  <tr
                    key={row.id}
                    className={row.low ? "bg-red-50" : undefined}
                  >
                    <th
                      scope="row"
                      className="px-4 py-3 font-semibold text-stone-900"
                    >
                      {row.name}
                      {row.low && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          Sắp hết
                        </span>
                      )}
                    </th>
                    <td className="px-4 py-3">
                      {amount(row.quantity, row.unit)}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {row.reserved > 0 ? amount(row.reserved, row.unit) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.cupsLeft === null
                        ? "—"
                        : `${row.cupsLeft.toLocaleString("vi-VN")} ly`}
                    </td>
                    <td className="px-4 py-3 text-stone-600">
                      {row.usedBy.length ? row.usedBy.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mt-8 text-lg font-bold">Số ly còn bán của từng món</h2>
          <p className="text-sm text-stone-600">
            Tính cho size S, không topping.
          </p>
          <ul
            aria-label="Số ly còn bán"
            className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {data.products.map((product) => (
              <li
                key={product.id}
                className={`rounded-2xl border bg-white p-4 ${product.sellableCups === 0 ? "border-red-300" : "border-stone-200"}`}
              >
                <p className="font-semibold text-stone-900">{product.name}</p>
                <p
                  className={`mt-1 text-2xl font-bold ${product.sellableCups === 0 ? "text-red-700" : "text-amber-900"}`}
                >
                  {product.sellableCups === 0
                    ? "Hết"
                    : `${product.sellableCups.toLocaleString("vi-VN")} ly`}
                </p>
                {product.limitingIngredientId && (
                  <p className="mt-1 text-xs text-stone-500">
                    Giới hạn bởi:{" "}
                    {nameOf.get(product.limitingIngredientId) ??
                      product.limitingIngredientId}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
