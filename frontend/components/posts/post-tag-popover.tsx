"use client";

import { useState, useEffect } from "react";
import { Check, Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AccountTag } from "@/hooks/use-account-tags";

export interface PostTag {
  id: string;
  name: string;
  color: string;
}

interface PostTagPopoverProps {
  postId: string;
  postTags: PostTag[];
  accountTags: AccountTag[];
  onTagsChange: (tags: PostTag[]) => void;
  onCreateTag?: (name: string, color: string) => Promise<AccountTag | null>;
}

export function PostTagPopover({
  postId,
  postTags,
  accountTags,
  onTagsChange,
  onCreateTag,
}: PostTagPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedTagIds = new Set(postTags.map((t) => t.id));

  const handleToggleTag = async (tag: AccountTag) => {
    const supabase = createClient();
    const isSelected = selectedTagIds.has(tag.id);

    try {
      if (isSelected) {
        // 移除標籤
        await supabase
          .from("workspace_threads_post_tags")
          .delete()
          .eq("post_id", postId)
          .eq("tag_id", tag.id);

        onTagsChange(postTags.filter((t) => t.id !== tag.id));
      } else {
        // 新增標籤
        await supabase
          .from("workspace_threads_post_tags")
          .insert({ post_id: postId, tag_id: tag.id });

        onTagsChange([...postTags, { id: tag.id, name: tag.name, color: tag.color }]);
      }
    } catch (err) {
      console.error("Error toggling tag:", err);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !onCreateTag) return;

    setIsSubmitting(true);
    try {
      const newTag = await onCreateTag(newTagName.trim(), "#6B7280");
      if (newTag) {
        // 自動貼上新標籤
        const supabase = createClient();
        await supabase
          .from("workspace_threads_post_tags")
          .insert({ post_id: postId, tag_id: newTag.id });

        onTagsChange([...postTags, { id: newTag.id, name: newTag.name, color: newTag.color }]);
      }
      setNewTagName("");
      setIsCreating(false);
    } catch (err) {
      console.error("Error creating tag:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2"
          onClick={(e) => e.stopPropagation()}
        >
          {postTags.length === 0 ? (
            <>
              <Tag className="size-3" />
              <span className="text-xs text-muted-foreground">標籤</span>
            </>
          ) : (
            <div className="flex items-center gap-1">
              {postTags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
              {postTags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{postTags.length - 3}
                </span>
              )}
            </div>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-56 p-2"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          {/* 標籤列表 */}
          {accountTags.length === 0 && !isCreating && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              尚無標籤
            </p>
          )}

          {accountTags.map((tag) => (
            <button
              key={tag.id}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                selectedTagIds.has(tag.id) && "bg-accent"
              )}
              onClick={() => handleToggleTag(tag)}
            >
              <div
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              <span className="flex-1 truncate text-left">{tag.name}</span>
              {selectedTagIds.has(tag.id) && (
                <Check className="size-4 text-primary" />
              )}
            </button>
          ))}

          {/* 新增標籤 */}
          {isCreating ? (
            <div className="flex items-center gap-1 pt-1">
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="標籤名稱"
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateTag();
                  if (e.key === "Escape") setIsCreating(false);
                }}
              />
              <Button
                size="sm"
                className="h-8"
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || isSubmitting}
              >
                新增
              </Button>
            </div>
          ) : (
            onCreateTag && (
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="size-4" />
                新增標籤
              </button>
            )
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
