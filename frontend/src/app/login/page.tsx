import { LoginForm } from "@/components/orders/LoginForm";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={next || "/orders"} />;
}
