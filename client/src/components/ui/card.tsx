import type { HTMLAttributes } from "react";
import { classNames } from "@/utils/classNames";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "muted";
}

export function Card({ tone = "default", className, ...props }: CardProps) {
  return (
    <div
      className={classNames("card", tone === "muted" && "cardMuted", className)}
      {...props}
    />
  );
}
