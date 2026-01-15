"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  Clock,
  BarChart3,
  History,
  LineChart,
  PieChart,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { CHART_COLORS_EXTENDED } from "@/lib/design-tokens";

// 動態數字組件
function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 30;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.floor(display).toLocaleString();

  return (
    <span>
      {prefix}{formatted}{suffix}
    </span>
  );
}

// 迷你折線圖動畫
function MiniChart({ color = CHART_COLORS_EXTENDED[0] }: { color?: string }) {
  return (
    <svg
      viewBox="0 0 100 40"
      className="w-full h-10 opacity-60"
      preserveAspectRatio="none"
    >
      <path
        d="M0,35 Q15,30 25,25 T50,20 T75,10 T100,5"
        fill="none"
        stroke={color}
        strokeWidth="2"
        className="animate-[draw_2s_ease-in-out_forwards]"
        style={{
          strokeDasharray: 200,
          strokeDashoffset: 200,
          animation: "draw 2s ease-in-out forwards",
        }}
      />
      <style>{`
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );
}

// 第一頁：基礎數據分析 - 使用 design-tokens 顏色
const page1Features = [
  {
    icon: TrendingUp,
    title: "貼文成效追蹤",
    description: "每篇貼文的觀看、互動數據，完整記錄成長軌跡",
    metric: { value: 156, suffix: " 篇", prefix: "", label: "已追蹤貼文" },
    color: CHART_COLORS_EXTENDED[0], // Teal
  },
  {
    icon: Clock,
    title: "發文時間分析",
    description: "根據你的歷史數據，找出互動率最高的時段",
    metric: { value: 21, suffix: ":00", prefix: "", label: "你的黃金時段" },
    color: CHART_COLORS_EXTENDED[1], // Amber
  },
  {
    icon: BarChart3,
    title: "互動趨勢洞察",
    description: "觀察長期趨勢變化，了解內容表現起伏",
    metric: { value: 5.8, suffix: "%", prefix: "", label: "平均互動率", decimals: 1 },
    color: CHART_COLORS_EXTENDED[2], // Violet
  },
  {
    icon: History,
    title: "歷史數據保存",
    description: "Threads 不提供的歷史紀錄，我們幫你完整保留",
    metric: { value: 30, suffix: " 天", prefix: "", label: "數據回溯" },
    color: CHART_COLORS_EXTENDED[3], // Pink
  },
];

// 第二頁：進階數據分析 - 使用 design-tokens 顏色
const page2Features = [
  {
    icon: LineChart,
    title: "粉絲成長曲線",
    description: "追蹤追蹤者數量變化，掌握帳號成長節奏",
    metric: { value: 847, suffix: "", prefix: "+", label: "本月新增追蹤" },
    color: CHART_COLORS_EXTENDED[0], // Teal
  },
  {
    icon: PieChart,
    title: "內容表現分析",
    description: "哪類主題最受歡迎？用數據優化你的內容策略",
    metric: { value: 12.3, suffix: "%", prefix: "", label: "最佳類型互動率", decimals: 1 },
    color: CHART_COLORS_EXTENDED[1], // Amber
  },
  {
    icon: ArrowLeftRight,
    title: "時段成效比較",
    description: "本週 vs 上週、本月 vs 上月，一目了然的成長對比",
    metric: { value: 23, suffix: "%", prefix: "+", label: "週成長率" },
    color: CHART_COLORS_EXTENDED[2], // Violet
  },
  {
    icon: BarChart3,
    title: "單篇深度分析",
    description: "點擊任一貼文，查看完整的成效變化歷程",
    metric: { value: 48, suffix: " hr", prefix: "", label: "追蹤發布後" },
    color: CHART_COLORS_EXTENDED[3], // Pink
  },
];

const pages = [
  { id: 0, title: "基礎分析", features: page1Features },
  { id: 1, title: "進階洞察", features: page2Features },
];

export function DemoPreview() {
  const [currentPage, setCurrentPage] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const goToPage = (page: number) => {
    if (isAnimating || page === currentPage) return;
    setIsAnimating(true);
    setCurrentPage(page);
    setTimeout(() => setIsAnimating(false), 500);
  };

  const features = pages[currentPage].features;

  return (
    <div className="relative mx-auto max-w-4xl">
      {/* Cards Grid */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-300 ${
          isAnimating ? "opacity-0" : "opacity-100"
        }`}
      >
        {features.map((feature, index) => (
          <Card
            key={`${currentPage}-${index}`}
            className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden"
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${feature.color}15` }}
                >
                  <feature.icon
                    className="size-5"
                    style={{ color: feature.color }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>

              {/* Metric + Mini Chart */}
              <div className="mt-4 pt-4 border-t flex items-end justify-between">
                <div>
                  <div
                    className="text-2xl font-bold"
                    style={{ color: feature.color }}
                  >
                    <AnimatedNumber
                      value={feature.metric.value}
                      suffix={feature.metric.suffix}
                      prefix={feature.metric.prefix || ""}
                      decimals={feature.metric.decimals || 0}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {feature.metric.label}
                  </div>
                </div>
                <div className="w-20">
                  <MiniChart color={feature.color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <button
          onClick={() => goToPage(currentPage - 1 < 0 ? pages.length - 1 : currentPage - 1)}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="上一頁"
        >
          <ChevronLeft className="size-5 text-muted-foreground" />
        </button>

        <div className="flex items-center gap-2">
          {pages.map((page, i) => (
            <button
              key={page.id}
              onClick={() => goToPage(i)}
              className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                i === currentPage
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {page.title}
            </button>
          ))}
        </div>

        <button
          onClick={() => goToPage((currentPage + 1) % pages.length)}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="下一頁"
        >
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
      </div>

      {/* Subtle hint */}
      <p className="text-center text-sm text-muted-foreground mt-6">
        連結帳號後，即可開始追蹤你的 Threads 成效
      </p>
    </div>
  );
}
