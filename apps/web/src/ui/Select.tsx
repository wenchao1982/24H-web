import type { SelectHTMLAttributes } from "react";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select className={["ds-select", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </select>
  );
}
