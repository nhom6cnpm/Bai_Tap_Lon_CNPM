'use client';

import { QueryClient, QueryClientContext, QueryClientProvider } from '@tanstack/react-query';
import { useContext, useState, type ReactNode } from 'react';

export default function ProductQueryProvider({ children }: { children: ReactNode }) {
  const sharedClient = useContext(QueryClientContext);
  const [localClient] = useState(() => new QueryClient());
  // Reuse Task 3's app provider when it is added to layout.tsx.
  // Until then, this route works independently without changing that file.
  if (sharedClient) return children;
  return <QueryClientProvider client={localClient}>{children}</QueryClientProvider>;
}
