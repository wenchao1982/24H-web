import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./icons";
import type { ButtonVariant } from "./Button";

export type IconTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: IconName;
  size?: number;
  variant?: ButtonVariant;
  tone?: IconTone;
}

export function IconButton({
  label,
  icon,
  size,
  variant,
  tone,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const classes = [
    "ds-btn",
    "ds-btn--icon",
    variant ? `ds-btn--${variant}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      data-tone={tone}
      aria-label={label}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
