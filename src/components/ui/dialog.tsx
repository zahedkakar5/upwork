"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} onClose={onClose} aria-label={title}>
      <h2>{title}</h2>
      {children}
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    </dialog>
  );
}
