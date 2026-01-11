"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TagFormDialog } from "./tag-form-dialog";
import { TagDeleteDialog } from "./tag-delete-dialog";
import type { AccountTag } from "@/hooks/use-account-tags";

interface TagsListProps {
  tags: AccountTag[];
  isLoading: boolean;
  onCreateTag: (name: string, color: string) => Promise<AccountTag | null>;
  onUpdateTag: (id: string, name: string, color: string) => Promise<boolean>;
  onDeleteTag: (id: string) => Promise<boolean>;
}

export function TagsList({
  tags,
  isLoading,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
}: TagsListProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<AccountTag | null>(null);

  const handleCreate = () => {
    setSelectedTag(null);
    setIsFormOpen(true);
  };

  const handleEdit = (tag: AccountTag) => {
    setSelectedTag(tag);
    setIsFormOpen(true);
  };

  const handleDelete = (tag: AccountTag) => {
    setSelectedTag(tag);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = async (name: string, color: string) => {
    if (selectedTag) {
      await onUpdateTag(selectedTag.id, name, color);
    } else {
      await onCreateTag(name, color);
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedTag) {
      await onDeleteTag(selectedTag.id);
    }
  };

  // 載入中
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 標題和新增按鈕 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {tags.length} 個標籤
        </p>
        <Button onClick={handleCreate} size="sm">
          <Plus className="mr-1 size-4" />
          新增標籤
        </Button>
      </div>

      {/* 空狀態 */}
      {tags.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Tag className="size-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">尚無標籤</p>
            <p className="text-sm text-muted-foreground">
              建立標籤來分類你的貼文
            </p>
            <Button onClick={handleCreate} className="mt-4">
              <Plus className="mr-1 size-4" />
              新增第一個標籤
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 標籤列表 */}
      {tags.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <Card key={tag.id} className="group">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {/* 顏色圓點 */}
                  <div
                    className="size-4 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {/* 名稱和貼文數 */}
                  <div>
                    <p className="font-medium">{tag.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {tag.postCount} 篇貼文
                    </p>
                  </div>
                </div>

                {/* 操作按鈕 */}
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => handleEdit(tag)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(tag)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 對話框 */}
      <TagFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        tag={selectedTag}
        onSubmit={handleFormSubmit}
      />

      <TagDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        tag={selectedTag}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
