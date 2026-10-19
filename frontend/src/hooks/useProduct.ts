'use client';
import { useQuery } from '@tanstack/react-query';
import { fetchProduct } from '@/lib/api';

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
    enabled: !!id,
  });
}