/** 24H 品牌标记（Demo 用，回填生产时换成正式 SVG）。 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="24" height="24" rx="7" fill="var(--ds-accent)" />
      <path
        d="M6.5 16.5V7.5l5.5 5.5 5.5-5.5v9"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
