import { isRecord } from "@/lib/payments/api";
import { adminGet } from "./request";

export interface IngredientOverview {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  reserved: number;
  cupsLeft: number | null;
  low: boolean;
  usedBy: string[];
}
export interface ProductStock {
  id: string;
  name: string;
  sellableCups: number;
  limitingIngredientId: string | null;
}
export interface InventoryOverview {
  lowStockCups: number;
  ingredients: IngredientOverview[];
  products: ProductStock[];
}

const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export async function getInventoryOverview(
  token: string,
  signal?: AbortSignal,
): Promise<InventoryOverview> {
  const data = await adminGet("/admin/ingredients", token, signal);
  if (
    !isRecord(data) ||
    !Array.isArray(data.ingredients) ||
    !Array.isArray(data.products)
  )
    throw new Error("Dữ liệu nguyên liệu không hợp lệ.");
  return {
    lowStockCups: num(data.lowStockCups),
    ingredients: data.ingredients.filter(isRecord).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      unit: String(row.unit),
      quantity: num(row.quantity),
      reserved: num(row.reserved),
      cupsLeft: typeof row.cupsLeft === "number" ? row.cupsLeft : null,
      low: row.low === true,
      usedBy: Array.isArray(row.usedBy) ? row.usedBy.map(String) : [],
    })),
    products: data.products.filter(isRecord).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      sellableCups: num(row.sellableCups),
      limitingIngredientId:
        typeof row.limitingIngredientId === "string"
          ? row.limitingIngredientId
          : null,
    })),
  };
}
