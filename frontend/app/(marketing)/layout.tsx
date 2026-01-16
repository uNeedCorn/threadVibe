import type { Metadata } from "next";
import Script from "next/script";

const GA_MEASUREMENT_ID = "G-ZKZNXPN3Y8";

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
      {/* Google Analytics - 僅追蹤公開行銷頁面 */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
      {children}
    </div>
  );
}
