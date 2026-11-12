/** Marca: dos pasos que giran (un compás de baile). */
export function Logo({ tam = 40 }: { tam?: number }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="18" style={{ fill: "var(--marca)" }} />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" strokeWidth="5" strokeDasharray="70 37" strokeLinecap="round" transform="rotate(-30 32 32)" />
      <circle cx="32" cy="32" r="6" fill="#fff" />
    </svg>
  );
}
