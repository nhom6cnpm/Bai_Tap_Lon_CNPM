export default function VoucherIcon({
  className = "size-5",
  checked = false,
}: {
  className?: string;
  checked?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 5.5h16v3.25a3.25 3.25 0 0 0 0 6.5v3.25H4v-3.25a3.25 3.25 0 0 0 0-6.5Z" />
      <path d="M9 6v1.5m0 3.5v1.5m0 3.5v1.5M13 10h4m-4 4h3" />
      {checked && (
        <>
          <circle
            cx="18.5"
            cy="17.5"
            r="5"
            fill="currentColor"
            stroke="white"
            strokeWidth="1.5"
          />
          <path d="m16.3 17.5 1.4 1.4 2.9-3" stroke="white" />
        </>
      )}
    </svg>
  );
}
