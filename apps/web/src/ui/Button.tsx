import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./icons";

export type ButtonVariant = "primary" | "outline" | "ghost" | "danger" | "danger-solid";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: IconName;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "ds-btn--primary",
  outline: "ds-btn--outline",
  ghost: "ds-btn--ghost",
  danger: "ds-btn--danger",
  "danger-solid": "ds-btn--danger-solid",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "ds-btn--sm",
  md: "",
  lg: "ds-btn--lg",
};

export function Button({
  variant = "outline",
  size = "md",
  block = false,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    "ds-btn",
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    block ? "ds-btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}
