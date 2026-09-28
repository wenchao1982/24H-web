import type { ReactNode } from "react";

export interface StackProps {
  gap?: number;
  className?: string;
  children: ReactNode;
}

export function Stack({ gap = 12, className, children }: StackProps) {
  return (
    <div className={["ds-stack", className].filter(Boolean).join(" ")} style={{ gap }}>
      {children}
    </div>
  );
}
