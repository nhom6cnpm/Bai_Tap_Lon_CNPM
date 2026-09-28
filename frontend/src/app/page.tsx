'use client';

import { useEffect, useState } from 'react';

export default function Home() {
  const [message, setMessage] = useState('Đang kết nối backend...');

  useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_API_URL as string)
      .then((res) => res.text())
      .then(setMessage)
      .catch(() => setMessage('Không kết nối được backend'));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">☕ BrewLite</h1>
      <p className="text-lg">Backend nói: {message}</p>
    </main>
  );
}