/** WholeLeaf mark: one whole leaf wrapping a smaller, torn one. Two paths, one stroke weight. */
export function LeafMark({ size = 28, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d="M3.75 20.25C3 9.75 10.5 3 20.25 3.75C21 13.5 14.25 21 3.75 20.25Z" />
      <path d="M6.75 17.25C6.75 13.1 9.75 10.1 15 9l-1.9 1.9 1.1 1.1-2.2 1.5.7 1.9-2.6.75Z" />
    </svg>
  );
}
