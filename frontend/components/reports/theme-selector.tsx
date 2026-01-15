"use client";

import { useState } from "react";
import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ReportTheme } from "./summary-card-export";

interface ThemeSelectorProps {
  value: ReportTheme;
  customColor?: string;
  onChange: (theme: ReportTheme, customColor?: string) => void;
}

const THEME_OPTIONS: { value: Exclude<ReportTheme, "custom">; label: string; color: string }[] = [
  { value: "default", label: "預設 (綠)", color: "#14B8A6" },
  { value: "dark", label: "深色", color: "#1E293B" },
  { value: "blue", label: "商務藍", color: "#3B82F6" },
];

export function ThemeSelector({ value, customColor, onChange }: ThemeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [tempCustomColor, setTempCustomColor] = useState(customColor || "#14B8A6");

  const selectedTheme = THEME_OPTIONS.find((t) => t.value === value);
  const displayColor = value === "custom" ? customColor : selectedTheme?.color;
  const displayLabel = value === "custom" ? "自訂色" : selectedTheme?.label;

  const handleCustomColorApply = () => {
    if (/^#[0-9A-Fa-f]{6}$/.test(tempCustomColor)) {
      onChange("custom", tempCustomColor);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[180px] justify-start gap-2">
          <div
            className="h-4 w-4 rounded-full border"
            style={{ backgroundColor: displayColor }}
          />
          <span className="flex-1 text-left">{displayLabel}</span>
          <Palette className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-3" align="start">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">預設主題</Label>
            <div className="grid gap-1">
              {THEME_OPTIONS.map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => {
                    onChange(theme.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                    value === theme.value && "bg-accent"
                  )}
                >
                  <div
                    className="h-4 w-4 rounded-full border"
                    style={{ backgroundColor: theme.color }}
                  />
                  <span className="flex-1 text-left">{theme.label}</span>
                  {value === theme.value && <Check className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs text-muted-foreground">自訂顏色</Label>
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <div
                  className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border"
                  style={{ backgroundColor: tempCustomColor }}
                />
                <Input
                  value={tempCustomColor}
                  onChange={(e) => setTempCustomColor(e.target.value)}
                  placeholder="#14B8A6"
                  className="pl-8 font-mono text-sm"
                />
              </div>
              <Button
                size="sm"
                onClick={handleCustomColorApply}
                disabled={!/^#[0-9A-Fa-f]{6}$/.test(tempCustomColor)}
              >
                套用
              </Button>
            </div>
            {value === "custom" && (
              <p className="mt-1 text-xs text-muted-foreground">
                目前使用：{customColor}
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
