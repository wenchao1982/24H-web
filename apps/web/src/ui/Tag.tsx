import type { ReactNode } from "react";

export type TagTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface TagProps {
  tone?: TagTone;
  children: ReactNode;
}

export function Tag({ tone = "neutral", children }: TagProps) {
  return (
    <span className="ds-tag" data-tone={tone}>
      {children}
    </span>
  );
}
