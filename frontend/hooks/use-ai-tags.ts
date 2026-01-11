"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSelectedAccount } from "./use-selected-account";

interface TagResult {
  tag: string;
  confidence: number;
}

interface AiSuggestedTags {
  content_type?: TagResult[];
  tone?: TagResult[];
  intent?: TagResult[];
  emotion?: TagResult[];
  audience?: TagResult[];
}

interface AiSelectedTags {
  content_type?: string[];
  tone?: string[];
  intent?: string[];
  emotion?: string[];
  audience?: string[];
}

export interface AggregatedAiTag {
  tag: string;
  dimension: string;
  totalCount: number;
  selectedCount: number;
  avgConfidence: number;
}

interface UseAiTagsResult {
  selectedTags: AggregatedAiTag[];
  unselectedTags: AggregatedAiTag[];
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const DIMENSIONS = ["content_type", "tone", "intent", "emotion", "audience"] as const;

/**
 * 取得帳號的 AI 標籤統計
 */
export function useAiTags(): UseAiTagsResult {
  const { selectedAccountId, isLoading: isAccountLoading } = useSelectedAccount();
  const [selectedTags, setSelectedTags] = useState<AggregatedAiTag[]>([]);
  const [unselectedTags, setUnselectedTags] = useState<AggregatedAiTag[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAiTags = useCallback(async () => {
    if (!selectedAccountId) {
      setSelectedTags([]);
      setUnselectedTags([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { data: posts, error } = await supabase
      .from("workspace_threads_posts")
      .select("id, ai_suggested_tags, ai_selected_tags")
      .eq("workspace_threads_account_id", selectedAccountId)
      .not("ai_suggested_tags", "is", null);

    if (error) {
      console.error("Error fetching AI tags:", error);
      setIsLoading(false);
      return;
    }

    // 聚合標籤資料
    const tagMap = new Map<string, {
      tag: string;
      dimension: string;
      totalCount: number;
      selectedCount: number;
      confidenceSum: number;
    }>();

    for (const post of posts || []) {
      const suggested = post.ai_suggested_tags as AiSuggestedTags | null;
      const selected = post.ai_selected_tags as AiSelectedTags | null;

      if (!suggested) continue;

      for (const dimension of DIMENSIONS) {
        const dimTags = suggested[dimension];
        const selectedDimTags = selected?.[dimension] || [];

        if (!dimTags) continue;

        for (const tagResult of dimTags) {
          const key = `${dimension}:${tagResult.tag}`;
          const existing = tagMap.get(key);
          const isSelected = selectedDimTags.includes(tagResult.tag);

          if (existing) {
            existing.totalCount += 1;
            existing.confidenceSum += tagResult.confidence;
            if (isSelected) {
              existing.selectedCount += 1;
            }
          } else {
            tagMap.set(key, {
              tag: tagResult.tag,
              dimension,
              totalCount: 1,
              selectedCount: isSelected ? 1 : 0,
              confidenceSum: tagResult.confidence,
            });
          }
        }
      }
    }

    // 轉換為結果格式
    const allTags: AggregatedAiTag[] = Array.from(tagMap.values()).map((item) => ({
      tag: item.tag,
      dimension: item.dimension,
      totalCount: item.totalCount,
      selectedCount: item.selectedCount,
      avgConfidence: item.confidenceSum / item.totalCount,
    }));

    // 分類已選擇和未選擇
    const selected = allTags
      .filter((t) => t.selectedCount > 0)
      .sort((a, b) => b.selectedCount - a.selectedCount);

    const unselected = allTags
      .filter((t) => t.selectedCount === 0)
      .sort((a, b) => b.avgConfidence - a.avgConfidence);

    setSelectedTags(selected);
    setUnselectedTags(unselected);
    setIsLoading(false);
  }, [selectedAccountId]);

  useEffect(() => {
    if (!isAccountLoading) {
      fetchAiTags();
    }
  }, [fetchAiTags, isAccountLoading]);

  return {
    selectedTags,
    unselectedTags,
    isLoading: isLoading || isAccountLoading,
    refetch: fetchAiTags,
  };
}
