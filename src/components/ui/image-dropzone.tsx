"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
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

  function handleFiles(fileList: FileList | null) {
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
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
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
          หรือลาก &amp; วางไฟล์ที่นี่ · JPG, PNG, WEBP ไม่เกิน {maxSizeMB}MB
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
