"use client";

import { useSelectedAccount } from "@/hooks/use-selected-account";
import { useAccountTags } from "@/hooks/use-account-tags";
import { useAiTags } from "@/hooks/use-ai-tags";
import { TagsList, AiTagsSection } from "@/components/tags";

export default function TagsPage() {
  const { selectedAccountId, isLoading: isAccountLoading } = useSelectedAccount();
  const { tags, isLoading, createTag, updateTag, deleteTag } = useAccountTags();
  const { selectedTags, unselectedTags, isLoading: isAiTagsLoading } = useAiTags();

  const hasNoAccount = !isAccountLoading && !selectedAccountId;

  return (
    <div className="space-y-8">
      {/* 標題 */}
      <div>
        <h1 className="text-2xl font-bold">標籤管理</h1>
        <p className="text-muted-foreground">
          建立和管理標籤，用於分類你的貼文
        </p>
      </div>

      {/* 無帳號提示 */}
      {hasNoAccount && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            尚未連結任何 Threads 帳號，請先至設定頁面連結帳號。
          </p>
        </div>
      )}

      {/* 自訂標籤列表 */}
      {!hasNoAccount && (
        <>
          <section>
            <h2 className="mb-4 text-lg font-semibold">自訂標籤</h2>
            <TagsList
              tags={tags}
              isLoading={isLoading || isAccountLoading}
              onCreateTag={createTag}
              onUpdateTag={updateTag}
              onDeleteTag={deleteTag}
            />
          </section>

          {/* AI 標籤區塊 */}
          <section>
            <h2 className="mb-4 text-lg font-semibold">AI 標籤分析</h2>
            <AiTagsSection
              selectedTags={selectedTags}
              unselectedTags={unselectedTags}
              isLoading={isAiTagsLoading}
            />
          </section>
        </>
      )}
    </div>
  );
}
