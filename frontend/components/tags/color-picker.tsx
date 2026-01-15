"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { TAG_PRESET_COLORS } from "@/lib/design-tokens";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState("");
  const isCustom = !TAG_PRESET_COLORS.some((c) => c.value === value);

  const handleCustomChange = (hex: string) => {
    setCustomColor(hex);
    // 驗證 HEX 格式
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex);
    }
  };

  return (
    <div className="space-y-3">
      <Label>標籤顏色</Label>

      {/* 預設顏色 */}
      <div className="flex flex-wrap gap-2">
        {TAG_PRESET_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            className={cn(
              "relative size-8 rounded-full transition-transform hover:scale-110",
              value === color.value && "ring-2 ring-offset-2 ring-primary"
            )}
            style={{ backgroundColor: color.value }}
            onClick={() => {
              onChange(color.value);
              setCustomColor("");
            }}
            title={color.name}
          >
            {value === color.value && (
              <Check className="absolute inset-0 m-auto size-4 text-white drop-shadow" />
            )}
          </button>
        ))}
      </div>

      {/* 自訂顏色 */}
      <div className="flex items-center gap-2">
        <div
          className="size-8 shrink-0 rounded-full border"
          style={{ backgroundColor: isCustom ? value : customColor || "#FFFFFF" }}
        />
        <Input
          type="text"
          placeholder="#FFFFFF"
          value={isCustom ? value : customColor}
          onChange={(e) => handleCustomChange(e.target.value.toUpperCase())}
          className="w-28 font-mono text-sm"
          maxLength={7}
        />
        <span className="text-xs text-muted-foreground">自訂 HEX</span>
      </div>
    </div>
  );
}
