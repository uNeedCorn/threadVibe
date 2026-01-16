import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "資料刪除 - Postlyzer",
  description: "了解如何刪除您在 Postlyzer 的資料",
};

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="size-4" />
          返回首頁
        </Link>

        {/* Header */}
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            資料刪除
          </h1>
          <p className="text-muted-foreground">
            最後更新：2026 年 1 月
          </p>
        </header>

        {/* Content */}
        <article className="space-y-8">
          <p className="text-lg text-muted-foreground leading-relaxed">
            Postlyzer 重視您的隱私權。您可以隨時刪除您在 Postlyzer 上的所有資料。
          </p>

          {/* Self-service deletion */}
          <section className="rounded-lg border bg-card p-6">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Settings className="size-5 text-primary" />
              </div>
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-foreground">
                  自助刪除（推薦）
                </h2>
                <p className="text-muted-foreground">
                  登入您的帳號後，前往「設定」頁面的「危險區域」，您可以：
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>刪除單一 Workspace 及其所有資料</li>
                  <li>刪除整個帳號及所有相關資料</li>
                </ul>
                <Button asChild className="mt-2">
                  <Link href="/settings">
                    <Trash2 className="mr-2 size-4" />
                    前往設定頁面
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* What gets deleted */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              刪除帳號時會移除的資料
            </h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>您的個人資料（姓名、電子郵件）</li>
              <li>您連結的 Threads 帳號資訊</li>
              <li>所有同步的貼文及成效數據</li>
              <li>您建立的 Workspace 及其所有資料</li>
              <li>自訂標籤及分類設定</li>
              <li>排程貼文及草稿</li>
            </ul>
          </section>

          {/* Processing time */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              處理時間
            </h2>
            <p className="text-muted-foreground">
              透過設定頁面刪除帳號後，您的資料將立即從系統中移除。備份資料將在 30 天內完全清除。
            </p>
          </section>

          {/* Contact */}
          <section className="rounded-lg border bg-muted/50 p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              需要協助？
            </h2>
            <p className="text-muted-foreground mb-4">
              如果您無法登入帳號或需要其他協助，請聯繫我們：
            </p>
            <p className="text-foreground">
              <a href="mailto:support@metricdesk.io" className="text-primary hover:underline">
                support@metricdesk.io
              </a>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              請在郵件中提供您的註冊電子郵件地址，我們會在 7 個工作天內處理您的請求。
            </p>
          </section>
        </article>
      </div>
    </main>
  );
}
