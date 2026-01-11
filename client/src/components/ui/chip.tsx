import type { HTMLAttributes } from "react";
import { classNames } from "@/utils/classNames";

export type ChipTone = "success" | "warning" | "danger" | "info";

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
}

export function Chip({ tone = "info", className, ...props }: ChipProps) {
  return (
    <span
      className={classNames("chip", `chip${tone[0].toUpperCase()}${tone.slice(1)}`, className)}
      {...props}
    />
  );
}
