"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  AlertCircle,
  Eye,
  Users,
  TrendingUp,
  Lightbulb,
  Building2,
  Construction,
} from "lucide-react";

export default function WatchlistPage() {
  const { isAdmin, isLoading: isUserLoading } = useCurrentUser();

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>您沒有權限訪問此頁面</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">帳號觀測</h1>
            <Badge variant="outline" className="gap-1 text-orange-600 border-orange-300 bg-orange-50">
              <Construction className="size-3" />
              開發中
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            追蹤感興趣的 Threads 帳號，掌握動態與成效趨勢
          </p>
        </div>
      </div>

      {/* 開發中提示 */}
      <Alert className="border-orange-200 bg-orange-50 text-orange-800">
        <Construction className="size-4 text-orange-600" />
        <AlertDescription>
          此功能目前正在開發中，預計將支援追蹤任意 Threads 帳號的公開數據。
        </AlertDescription>
      </Alert>

      {/* 功能規劃卡片 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* 使用情境 1: KOL 追蹤 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="size-5 text-amber-500" />
              學習與靈感
            </CardTitle>
            <CardDescription>
              追蹤大 KOL 或同領域創作者，學習他們的內容策略
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Eye className="size-4" />
                觀察發文頻率與時間分布
              </li>
              <li className="flex items-center gap-2">
                <TrendingUp className="size-4" />
                分析熱門內容特徵
              </li>
              <li className="flex items-center gap-2">
                <Users className="size-4" />
                追蹤粉絲成長趨勢
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* 使用情境 2: 競品監測 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="size-5 text-blue-500" />
              競品監測
            </CardTitle>
            <CardDescription>
              監測競爭對手的 Threads 動態，掌握市場脈動
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Eye className="size-4" />
                即時追蹤競品新貼文
              </li>
              <li className="flex items-center gap-2">
                <TrendingUp className="size-4" />
                比較互動數據表現
              </li>
              <li className="flex items-center gap-2">
                <Users className="size-4" />
                分析受眾反應差異
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* 規劃功能清單 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">規劃功能</CardTitle>
          <CardDescription>
            以下功能正在規劃中，歡迎提供意見回饋
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                <Users className="size-4" />
              </div>
              <div>
                <p className="font-medium text-sm">追蹤名單管理</p>
                <p className="text-xs text-muted-foreground">新增、移除要觀測的帳號</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                <TrendingUp className="size-4" />
              </div>
              <div>
                <p className="font-medium text-sm">成效趨勢圖表</p>
                <p className="text-xs text-muted-foreground">視覺化呈現追蹤帳號的數據變化</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                <Eye className="size-4" />
              </div>
              <div>
                <p className="font-medium text-sm">新貼文通知</p>
                <p className="text-xs text-muted-foreground">追蹤帳號發文時收到提醒</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                <Lightbulb className="size-4" />
              </div>
              <div>
                <p className="font-medium text-sm">內容靈感推薦</p>
                <p className="text-xs text-muted-foreground">基於追蹤帳號的熱門內容提供靈感</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
