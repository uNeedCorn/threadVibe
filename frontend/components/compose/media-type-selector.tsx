"use client";

import { FileText, Image, Video, Images } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type MediaType = "TEXT" | "IMAGE" | "VIDEO" | "CAROUSEL";

interface MediaTypeSelectorProps {
  value: MediaType;
  onChange: (value: MediaType) => void;
  disabled?: boolean;
  /** 精簡模式：小圖示 + tooltip */
  compact?: boolean;
}

const mediaTypes: {
  value: MediaType;
  label: string;
  tip: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "TEXT", label: "文字", tip: "純文字貼文", icon: FileText },
  { value: "IMAGE", label: "圖片", tip: "附加單張圖片", icon: Image },
  { value: "VIDEO", label: "影片", tip: "附加影片", icon: Video },
  { value: "CAROUSEL", label: "輪播", tip: "多張圖片輪播", icon: Images },
];

export function MediaTypeSelector({
  value,
  onChange,
  disabled,
  compact = false,
}: MediaTypeSelectorProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {mediaTypes.map((type) => (
          <Tooltip key={type.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onChange(type.value)}
                disabled={disabled}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-colors",
                  value === type.value
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                <type.icon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {type.tip}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    );
  }

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
