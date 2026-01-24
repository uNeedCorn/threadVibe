import type { Metadata } from "next";
import { HealthCheckClient } from "./components/health-check-client";

export const metadata: Metadata = {
  title: "Threads 健康檢測器 - Postlyzer",
  description:
    "免費檢測你的 Threads 帳號是否被限流。輸入粉絲數和貼文曝光數，立即得到健康分析報告。",
  openGraph: {
    title: "Threads 健康檢測器 - Postlyzer",
    description:
      "免費檢測你的 Threads 帳號是否被限流。輸入粉絲數和貼文曝光數，立即得到健康分析報告。",
    type: "website",
  },
};

export default function HealthCheckPage() {
  return <HealthCheckClient />;
}
