"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RefreshCw, TrendingUp, Zap, Clock, Snowflake } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { WaitlistCta } from "./waitlist-cta";
import { cn } from "@/lib/utils";
import type { HealthCheckResult, RateLimitInfo } from "./health-check-client";

interface ResultSectionProps {
  result: HealthCheckResult;
  rateLimit: RateLimitInfo | null;
  onTryAgain: () => void;
}

const metricCards = [
  {
    key: "cumulative" as const,
    title: "累計觸及倍數",
    icon: TrendingUp,
    description: "所有貼文總曝光 / 粉絲數",
  },
  {
    key: "max" as const,
    title: "最高單篇倍數",
    icon: Zap,
    description: "表現最好的貼文",
  },
  {
    key: "latest" as const,
    title: "最近貼文倍數",
    icon: Clock,
    description: "最新一篇貼文",
  },
];

// 根據整體狀態獲取背景樣式
function getOverallStatus(result: HealthCheckResult): "normal" | "warning" | "danger" {
  const statuses = [result.cumulative.status, result.max.status, result.latest.status];
  if (statuses.includes("danger")) return "danger";
  if (statuses.includes("warning")) return "warning";
  return "normal";
}

const statusBgClasses = {
  normal: "bg-gradient-to-b from-green-50/50 to-transparent dark:from-green-950/20",
  warning: "bg-gradient-to-b from-yellow-50/50 to-transparent dark:from-yellow-950/20",
  danger: "bg-gradient-to-b from-red-50/50 to-transparent dark:from-red-950/20",
};

const statusBorderClasses = {
  normal: "border-green-200 dark:border-green-800/50",
  warning: "border-yellow-200 dark:border-yellow-800/50",
  danger: "border-red-200 dark:border-red-800/50",
};

const statusIndicatorClasses = {
  normal: "bg-green-500",
  warning: "bg-yellow-500",
  danger: "bg-red-500",
};

export function ResultSection({ result, rateLimit, onTryAgain }: ResultSectionProps) {
  const remainingChecks = rateLimit?.remaining ?? 0;
  const overallStatus = getOverallStatus(result);

  return (
    <div className={cn("min-h-screen px-4 py-16", statusBgClasses[overallStatus])}>
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">檢測結果</h1>
          <p className="text-muted-foreground">
            根據你輸入的數據，以下是帳號健康分析
          </p>
        </div>

        {/* 冷卻期警告 */}
        {result.inCooldown && (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <Snowflake className="size-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-200">
              可能處於冷卻期
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              你的帳號曾有爆發表現，但最近觸及較低。這是演算法的正常調整。
            </AlertDescription>
          </Alert>
        )}

        {/* 指標卡片 */}
        <div className="grid gap-4 md:grid-cols-3">
          {metricCards.map((card) => {
            const metric = result[card.key];
            const metricStatus = metric.status as "normal" | "warning" | "danger";
            return (
              <Card
                key={card.key}
                className={cn(
                  "relative overflow-hidden",
                  statusBorderClasses[metricStatus]
                )}
              >
                {/* Top status indicator bar */}
                <div
                  className={cn(
                    "absolute top-0 left-0 right-0 h-1",
                    statusIndicatorClasses[metricStatus]
                  )}
                />
                <CardHeader className="pb-2 pt-5">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <card.icon className="size-4" />
                    <span className="text-sm">{card.title}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-3xl font-bold tabular-nums">
                      {metric.value}x
                    </div>
                    <StatusBadge status={metric.status} label={metric.label} size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 結論 */}
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">分析結論</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{result.conclusion}</p>

            {result.recommendations.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">建議行動</h4>
                <ul className="space-y-3">
                  {result.recommendations.map((rec, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-sm text-muted-foreground"
                    >
                      <span className="flex-shrink-0 flex items-center justify-center size-5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                        {index + 1}
                      </span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 再測一次 */}
        <div className="text-center space-y-4">
          <Button
            variant="outline"
            size="lg"
            onClick={onTryAgain}
            disabled={remainingChecks <= 0}
          >
            <RefreshCw className="mr-2 size-4" />
            再測一次
            {remainingChecks > 0 && (
              <span className="ml-2 text-muted-foreground">
                （剩餘 {remainingChecks} 次）
              </span>
            )}
          </Button>

          {remainingChecks <= 0 && (
            <p className="text-sm text-muted-foreground">
              今日檢測次數已用完，明天再來吧！
            </p>
          )}
        </div>

        {/* Waitlist CTA */}
        <WaitlistCta />
      </div>
    </div>
  );
}
