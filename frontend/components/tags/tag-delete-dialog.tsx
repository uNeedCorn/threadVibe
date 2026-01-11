"use client";

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { AccountTag } from "@/hooks/use-account-tags";

interface TagDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: AccountTag | null;
  onConfirm: () => Promise<void>;
}

export function TagDeleteDialog({
  open,
  onOpenChange,
  tag,
  onConfirm,
}: TagDeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      console.error("Error deleting tag:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!tag) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            確認刪除標籤
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                確定要刪除標籤「
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
                」嗎？
              </p>
              {tag.postCount > 0 && (
                <p className="text-destructive">
                  此標籤已被 {tag.postCount} 篇貼文使用，刪除後將移除所有關聯。
                </p>
              )}
              <p className="text-muted-foreground">此操作無法復原。</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting && <Loader2 className="mr-2 size-4 animate-spin" />}
            刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
