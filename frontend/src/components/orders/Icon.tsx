export function Icon({
  name,
  size = 20,
}: {
  name:
    | "cup"
    | "receipt"
    | "pin"
    | "check"
    | "arrow"
    | "user"
    | "clock"
    | "share"
    | "refresh";
  size?: number;
}) {
  const paths = {
    cup: "M4 4h12v8a6 6 0 0 1-12 0V4Zm12 1h2a3 3 0 0 1 0 6h-2M3 21h15M8 1v1m4-1v1",
    receipt: "M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm4 4h6m-6 4h6m-6 4h4",
    pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    check: "m5 12 4 4L19 6",
    arrow: "m9 5 7 7-7 7",
    user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 16 0v3H4Z",
    clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2",
    share:
      "m8 11 8-5m-8 7 8 5M8 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM22 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM22 20a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    refresh: "M20 7a9 9 0 1 0 1 9M20 2v6h-6",
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
