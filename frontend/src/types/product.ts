export interface Product {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
  description?: string;
}