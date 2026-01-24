"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

interface PostInput {
  id: string;
  views: string;
}

interface PostInputListProps {
  posts: PostInput[];
  onChange: (posts: PostInput[]) => void;
  disabled?: boolean;
  maxPosts?: number;
}

export function PostInputList({
  posts,
  onChange,
  disabled = false,
  maxPosts = 20,
}: PostInputListProps) {
  const addPost = () => {
    if (posts.length >= maxPosts) return;
    onChange([...posts, { id: crypto.randomUUID(), views: "" }]);
  };

  const removePost = (id: string) => {
    if (posts.length <= 1) return;
    onChange(posts.filter((p) => p.id !== id));
  };

  const updatePost = (id: string, views: string) => {
    onChange(posts.map((p) => (p.id === id ? { ...p, views } : p)));
  };

  return (
    <div className="space-y-3">
      {posts.map((post, index) => (
        <div key={post.id} className="flex gap-2">
          <div className="flex-shrink-0 flex items-center justify-center w-8 text-sm text-muted-foreground">
            #{index + 1}
          </div>
          <Input
            type="number"
            placeholder="曝光數"
            value={post.views}
            onChange={(e) => updatePost(post.id, e.target.value)}
            min={0}
            max={1000000000}
            disabled={disabled}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removePost(post.id)}
            disabled={disabled || posts.length <= 1}
            className="flex-shrink-0"
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        </div>
      ))}

      {posts.length < maxPosts && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPost}
          disabled={disabled}
          className="w-full"
        >
          <Plus className="size-4 mr-2" />
          新增貼文（{posts.length}/{maxPosts}）
        </Button>
      )}
    </div>
  );
}
