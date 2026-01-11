"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorPicker } from "./color-picker";
import type { AccountTag } from "@/hooks/use-account-tags";

interface TagFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: AccountTag | null;
  onSubmit: (name: string, color: string) => Promise<void>;
}

export function TagFormDialog({
  open,
  onOpenChange,
  tag,
  onSubmit,
}: TagFormDialogProps) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6B7280");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!tag;

  // 初始化表單值
  useEffect(() => {
    if (open) {
      if (tag) {
        setName(tag.name);
        setColor(tag.color);
      } else {
        setName("");
        setColor("#6B7280");
      }
      setError(null);
    }
  }, [open, tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("請輸入標籤名稱");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(trimmedName, color);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error && err.message.includes("duplicate")) {
        setError("標籤名稱已存在");
      } else {
        setError("操作失敗，請稍後再試");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯標籤" : "新增標籤"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 標籤名稱 */}
          <div className="space-y-2">
            <Label htmlFor="tag-name">標籤名稱</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：教學文、產品推廣"
              autoFocus
              maxLength={50}
            />
          </div>

          {/* 顏色選擇 */}
          <ColorPicker value={color} onChange={setColor} />

          {/* 預覽 */}
          <div className="space-y-2">
            <Label>預覽</Label>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: color }}
              >
                {name.trim() || "標籤名稱"}
              </span>
            </div>
          </div>

          {/* 錯誤訊息 */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEdit ? "儲存" : "新增"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
