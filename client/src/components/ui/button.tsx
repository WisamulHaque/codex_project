import type { ButtonHTMLAttributes } from "react";
import { classNames } from "@/utils/classNames";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({
  variant = "primary",
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={classNames("btn", `btn${variant[0].toUpperCase()}${variant.slice(1)}`, className)}
      type={type}
      {...props}
    />
  );
}
