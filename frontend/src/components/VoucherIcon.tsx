export default function VoucherIcon({
  className = "size-5",
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 5h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6V6a1 1 0 0 1 1-1Z" />
      <path d="M9 5v2m0 4v2m0 4v2m4-4 4-6" />
      <circle cx="13.5" cy="9.5" r=".5" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="14.5" r=".5" fill="currentColor" stroke="none" />
    </svg>
  );
}
