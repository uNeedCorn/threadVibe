import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Postlyzer - 追蹤、分析你的 Threads 貼文成效",
  description:
    "自動同步貼文數據，讓數據驅動你的內容策略。支援多帳號管理，一站式追蹤所有 Threads 成效。",
  openGraph: {
    title: "Postlyzer - 追蹤、分析你的 Threads 貼文成效",
    description:
      "自動同步貼文數據，讓數據驅動你的內容策略。支援多帳號管理，一站式追蹤所有 Threads 成效。",
    type: "website",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {children}
    </div>
  );
}
