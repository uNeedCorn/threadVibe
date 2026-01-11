"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSelectedAccount } from "./use-selected-account";

export interface AccountTag {
  id: string;
  name: string;
  color: string;
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

interface UseAccountTagsResult {
  tags: AccountTag[];
  isLoading: boolean;
  error: Error | null;
  createTag: (name: string, color: string) => Promise<AccountTag | null>;
  updateTag: (id: string, name: string, color: string) => Promise<boolean>;
  deleteTag: (id: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useAccountTags(): UseAccountTagsResult {
  const { selectedAccountId } = useSelectedAccount();
  const [tags, setTags] = useState<AccountTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTags = useCallback(async () => {
    if (!selectedAccountId) {
      setTags([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // 查詢標籤並計算貼文數量
      const { data: tagsData, error: tagsError } = await supabase
        .from("workspace_threads_account_tags")
        .select(`
          id,
          name,
          color,
          created_at,
          updated_at,
          workspace_threads_post_tags (
            id
          )
        `)
        .eq("workspace_threads_account_id", selectedAccountId)
        .order("name", { ascending: true });

      if (tagsError) {
        throw tagsError;
      }

      const formattedTags: AccountTag[] = (tagsData || []).map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        postCount: Array.isArray(tag.workspace_threads_post_tags)
          ? tag.workspace_threads_post_tags.length
          : 0,
        createdAt: tag.created_at,
        updatedAt: tag.updated_at,
      }));

      setTags(formattedTags);
    } catch (err) {
      console.error("[useAccountTags] Error fetching tags:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId]);

  // 初始載入和帳號切換時重新載入
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // 新增標籤
  const createTag = useCallback(
    async (name: string, color: string): Promise<AccountTag | null> => {
      if (!selectedAccountId) return null;

      try {
        const supabase = createClient();
        const { data, error: createError } = await supabase
          .from("workspace_threads_account_tags")
          .insert({
            workspace_threads_account_id: selectedAccountId,
            name: name.trim(),
            color,
          })
          .select("id, name, color, created_at, updated_at")
          .single();

        if (createError) {
          throw createError;
        }

        const newTag: AccountTag = {
          id: data.id,
          name: data.name,
          color: data.color,
          postCount: 0,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };

        setTags((prev) => [...prev, newTag].sort((a, b) => a.name.localeCompare(b.name)));
        return newTag;
      } catch (err) {
        console.error("[useAccountTags] Error creating tag:", err);
        throw err;
      }
    },
    [selectedAccountId]
  );

  // 更新標籤
  const updateTag = useCallback(
    async (id: string, name: string, color: string): Promise<boolean> => {
      try {
        const supabase = createClient();
        const { error: updateError } = await supabase
          .from("workspace_threads_account_tags")
          .update({
            name: name.trim(),
            color,
          })
          .eq("id", id);

        if (updateError) {
          throw updateError;
        }

        setTags((prev) =>
          prev
            .map((tag) =>
              tag.id === id ? { ...tag, name: name.trim(), color } : tag
            )
            .sort((a, b) => a.name.localeCompare(b.name))
        );

        return true;
      } catch (err) {
        console.error("[useAccountTags] Error updating tag:", err);
        throw err;
      }
    },
    []
  );

  // 刪除標籤
  const deleteTag = useCallback(async (id: string): Promise<boolean> => {
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("workspace_threads_account_tags")
        .delete()
        .eq("id", id);

      if (deleteError) {
        throw deleteError;
      }

      setTags((prev) => prev.filter((tag) => tag.id !== id));
      return true;
    } catch (err) {
      console.error("[useAccountTags] Error deleting tag:", err);
      throw err;
    }
  }, []);

  return {
    tags,
    isLoading,
    error,
    createTag,
    updateTag,
    deleteTag,
    refetch: fetchTags,
  };
}
