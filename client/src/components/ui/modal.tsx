import { useId } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  actions?: ReactNode;
  size?: "sm" | "lg";
  variant?: "center" | "side";
  closeOnOverlayClick?: boolean;
  onClose: () => void;
  children?: ReactNode;
}

export function Modal({
  isOpen,
  title,
  description,
  actions,
  size = "sm",
  variant = "center",
  closeOnOverlayClick = false,
  onClose,
  children
}: ModalProps) {
  if (!isOpen) {
    return null;
  }

  const titleId = useId();
  const descriptionId = description ? useId() : undefined;

  return (
    <div
      className={`modalOverlay ${variant === "side" ? "modalOverlaySide" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={(event) => {
        if (closeOnOverlayClick && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`modalCard ${size === "lg" ? "modalCardLg" : "modalCardSm"} ${
          variant === "side" ? "modalCardSide" : ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modalHeader">
          <h3 id={titleId}>{title}</h3>
          <button className="modalClose" type="button" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>
        {description ? (
          <p className="muted" id={descriptionId}>
            {description}
          </p>
        ) : null}
        {children ? <div className="modalBody">{children}</div> : null}
        {actions ? <div className="modalActions">{actions}</div> : null}
      </div>
    </div>
  );
}
