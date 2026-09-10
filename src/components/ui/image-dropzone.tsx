"use client";

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImageDropzoneProps {
  id?: string;
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  maxSizeMB?: number;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp";

export function ImageDropzone({
  id,
  onFilesSelected,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = 5,
  multiple = false,
  disabled,
  className,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFiles(fileList: FileList | File[] | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;
    const oversized = files.find((f) => f.size > maxSizeMB * 1024 * 1024);
    if (oversized) {
      setError(`ไฟล์ใหญ่เกินไป (สูงสุด ${maxSizeMB}MB)`);
      return;
    }
    setError(null);
    onFilesSelected(multiple ? files : files.slice(0, 1));
  }

  // Always the latest handleFiles (closing over the current maxSizeMB/
  // multiple/onFilesSelected props) without re-subscribing the document
  // listener below on every render. Synced in an effect, not during render
  // (mutating a ref while rendering is unsafe).
  const handleFilesRef = useRef(handleFiles);
  useEffect(() => {
    handleFilesRef.current = handleFiles;
  });

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  }

  // Lets a screenshot go straight from the clipboard onto the form with a
  // plain Ctrl+V — no click-to-focus step first. A listener scoped to the
  // dropzone div itself doesn't work here: clicking the div to focus it
  // also fires openPicker(), which opens the native file dialog and steals
  // focus, so by the time the user pastes, the div was never the thing
  // holding focus. Listening on the document instead sidesteps that
  // entirely. Safe today since every page using this component renders at
  // most one instance; if a page ever needs two, whichever mounted last
  // would win an ambiguous paste — not a real constraint yet.
  useEffect(() => {
    if (disabled) return;
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = Array.from(items)
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => !!file);
      if (files.length === 0) return;
      e.preventDefault();
      handleFilesRef.current(files);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [disabled]);

  return (
    <div className="space-y-1">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        title="คลิกเพื่อเลือกไฟล์ หรือวางรูป (Ctrl+V) เช่น รูปที่แคปหน้าจอมา"
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
          dragActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
          disabled && "pointer-events-none cursor-not-allowed opacity-50",
          className,
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <ImageIcon className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">คลิกเพื่อเลือกรูปภาพ</p>
        <p className="text-xs text-muted-foreground">
          หรือลาก &amp; วางไฟล์ที่นี่ หรือวาง (Ctrl+V) · JPG, PNG, WEBP ไม่เกิน {maxSizeMB}MB
        </p>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
