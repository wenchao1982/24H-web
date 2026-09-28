import { useEffect, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="ds-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="ds-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        {title ? (
          <div className="ds-modal__head">
            <h2 className="ds-modal__title">{title}</h2>
          </div>
        ) : null}
        <div className="ds-modal__body">{children}</div>
        {footer ? <div className="ds-modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}
