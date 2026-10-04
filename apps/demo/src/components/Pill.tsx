import type { ComponentType, ReactNode } from "react";
import { ChevronDown, type LucideProps } from "lucide-react";
import { cn } from "../lib/cn";

export interface PillProps {
  icon?: ComponentType<LucideProps>;
  children: ReactNode;
  /** 右侧小徽标，如模型 Flash。 */
  badge?: ReactNode;
  active?: boolean;
  className?: string;
  onClick?: () => void;
}

/** hero/docked 通用 pill：图标 + 文本 + 可选徽标 + 下拉箭标。 */
export function Pill({ icon: Icon, children, badge, active, className, onClick }: PillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-pill border px-2.5 text-[13px] transition-colors",
        active
          ? "border-accent/40 bg-accent-weak text-accent"
          : "border-line-1 bg-s1 text-label-2 hover:bg-s2 hover:text-label-1",
        className,
      )}
    >
      {Icon ? <Icon size={15} className="text-label-3" /> : null}
      <span className="font-medium">{children}</span>
      {badge ? (
        <span className="rounded-[4px] bg-s3 px-1 font-mono text-[10px] text-label-3">{badge}</span>
      ) : null}
      <ChevronDown size={14} className="text-label-3" />
    </button>
  );
}
