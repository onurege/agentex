"use client";

// Minimal contentEditable wrapper — Draft modülündeki EditableText'in
// kardeşi. Span yerine div tabanlı (multiline ve blok layout için).

import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onCommit: (next: string) => void;
  ariaLabel: string;
  className?: string;
  multiline?: boolean;
  /** Sadece görsel etiket; gerçek tag her zaman div. */
  as?: "div" | "span";
  placeholder?: string;
  readOnly?: boolean;
}

export function EditableText({
  value,
  onCommit,
  ariaLabel,
  className,
  multiline = false,
  placeholder,
  readOnly = false,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    if (el.textContent !== value) {
      el.textContent = value;
    }
  }, [value]);

  if (readOnly) {
    return (
      <div className={className} aria-label={ariaLabel}>
        {value}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={multiline}
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      spellCheck
      className={className}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
      onBlur={(e) => {
        const next = e.currentTarget.textContent ?? "";
        if (next !== value) onCommit(next);
      }}
    >
      {value}
    </div>
  );
}
