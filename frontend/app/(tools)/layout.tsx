import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import Image from "next/image";

const GA_MEASUREMENT_ID = "G-ZKZNXPN3Y8";

export const metadata: Metadata = {
  title: "Postlyzer 工具",
  description: "免費的 Threads 創作者工具",
};

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Google Analytics */}
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

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="py-6 border-t bg-card">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <Link
            href="https://postlyzer.metricdesk.io"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Image
              src="/logo-icon.png"
              alt="Postlyzer"
              width={20}
              height={20}
              className="size-5"
            />
            <span>Powered by Postlyzer</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
