"use client";

import { useSelectedAccount } from "@/hooks/use-selected-account";
import { useAccountTags } from "@/hooks/use-account-tags";
import { TagsList } from "@/components/tags";

export default function TagsPage() {
  const { selectedAccountId, isLoading: isAccountLoading } = useSelectedAccount();
  const { tags, isLoading, createTag, updateTag, deleteTag } = useAccountTags();

  const hasNoAccount = !isAccountLoading && !selectedAccountId;

  return (
    <div className="space-y-6">
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

      {/* 標籤列表 */}
      {!hasNoAccount && (
        <TagsList
          tags={tags}
          isLoading={isLoading || isAccountLoading}
          onCreateTag={createTag}
          onUpdateTag={updateTag}
          onDeleteTag={deleteTag}
        />
      )}
    </div>
  );
}
