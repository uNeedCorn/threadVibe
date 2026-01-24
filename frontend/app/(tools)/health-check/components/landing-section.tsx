"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, TrendingUp, Shield, Zap } from "lucide-react";

interface LandingSectionProps {
  onLogin: () => void;
}

const features = [
  {
    icon: Activity,
    title: "即時檢測",
    description: "輸入數據立即得到分析結果",
  },
  {
    icon: TrendingUp,
    title: "觸及分析",
    description: "了解你的內容表現是否正常",
  },
  {
    icon: Shield,
    title: "限流預警",
    description: "提早發現帳號異常狀況",
  },
  {
    icon: Zap,
    title: "行動建議",
    description: "獲得具體的優化方向",
  },
];

export function LandingSection({ onLogin }: LandingSectionProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-6">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              免費工具
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Threads 健康檢測器
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
            擔心你的 Threads 帳號被限流嗎？
            <br />
            輸入粉絲數和貼文曝光數，立即得到健康分析報告。
          </p>

          <Button size="lg" onClick={onLogin} className="text-lg px-8 py-6">
            使用 Google 帳號登入
          </Button>

          <p className="mt-4 text-sm text-muted-foreground">
            每日可免費檢測 3 次
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">
            功能特色
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {features.map((feature) => (
              <Card key={feature.title} className="border-0 shadow-none bg-transparent">
                <CardContent className="pt-6 text-center">
                  <div className="inline-flex items-center justify-center size-12 rounded-full bg-primary/10 mb-4">
                    <feature.icon className="size-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">
            如何使用
          </h2>

          <div className="space-y-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1">輸入粉絲數</h3>
                <p className="text-muted-foreground">
                  填寫你目前的 Threads 粉絲數量
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">輸入貼文曝光數</h3>
                <p className="text-muted-foreground">
                  填寫近期貼文的曝光數（可輸入多篇）
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground font-bold text-sm">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">取得分析報告</h3>
                <p className="text-muted-foreground">
                  系統會計算觸及倍數，判斷帳號健康狀態
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
