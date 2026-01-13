"use client";

import { FileText, Image, Video, Images } from "lucide-react";
import { cn } from "@/lib/utils";

export type MediaType = "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";

interface MediaTypeSelectorProps {
  value: MediaType;
  onChange: (value: MediaType) => void;
  disabled?: boolean;
}

const mediaTypes: { value: MediaType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "TEXT", label: "文字", icon: FileText },
  { value: "IMAGE", label: "圖片", icon: Image },
  { value: "VIDEO", label: "影片", icon: Video },
  { value: "CAROUSEL", label: "輪播", icon: Images },
];

export function MediaTypeSelector({ value, onChange, disabled }: MediaTypeSelectorProps) {
  return (
    <div className="flex gap-2">
      {mediaTypes.map((type) => (
        <button
          key={type.value}
          type="button"
          onClick={() => onChange(type.value)}
          disabled={disabled}
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 transition-colors",
            value === type.value
              ? "border-primary bg-primary/5 text-primary"
              : "border-muted hover:border-border hover:bg-muted/50",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <type.icon className="size-5" />
          <span className="text-xs font-medium">{type.label}</span>
        </button>
      ))}
    </div>
  );
}
