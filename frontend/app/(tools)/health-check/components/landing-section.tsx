"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, TrendingUp, Shield, Zap, ArrowRight } from "lucide-react";

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

const steps = [
  {
    number: 1,
    title: "輸入粉絲數",
    description: "填寫你目前的 Threads 粉絲數量",
  },
  {
    number: 2,
    title: "輸入貼文曝光數",
    description: "填寫近期貼文的曝光數（可輸入多篇）",
  },
  {
    number: 3,
    title: "取得分析報告",
    description: "系統會計算觸及倍數，判斷帳號健康狀態",
  },
];

export function LandingSection({ onLogin }: LandingSectionProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero with background decorations */}
      <section className="relative flex-1 flex items-center justify-center px-4 py-16 overflow-hidden">
        {/* Background grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px),
              linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />
        {/* Primary glow - top right */}
        <div className="absolute -top-24 -right-24 size-96 bg-primary/10 rounded-full blur-3xl" />
        {/* Primary glow - bottom left */}
        <div className="absolute -bottom-32 -left-32 size-[500px] bg-primary/5 rounded-full blur-3xl" />

        <div className="relative max-w-2xl mx-auto text-center">
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {/* Pulsing dot */}
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
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

          <Button
            size="lg"
            onClick={onLogin}
            className="group text-lg px-8 py-6"
          >
            使用 Google 帳號登入
            <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
          </Button>

          <p className="mt-4 text-sm text-muted-foreground">
            每日可免費檢測 3 次
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">功能特色</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="border-0 shadow-none bg-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:bg-background/80"
              >
                <CardContent className="pt-6 text-center">
                  <div className="relative inline-flex items-center justify-center size-12 rounded-full bg-primary/10 mb-4">
                    {/* Glow effect */}
                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-md" />
                    <feature.icon className="relative size-6 text-primary" />
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
          <h2 className="text-2xl font-bold text-center mb-12">如何使用</h2>

          <div className="relative space-y-8">
            {steps.map((step, index) => (
              <div key={step.number} className="relative flex gap-4">
                {/* Vertical connecting line */}
                {index < steps.length - 1 && (
                  <div
                    className="absolute left-4 top-8 bottom-0 w-px -translate-x-1/2"
                    style={{
                      background:
                        "linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--primary) / 0.2))",
                    }}
                  />
                )}
                <div className="relative flex-shrink-0 flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground font-bold text-sm ring-4 ring-primary/20">
                  {step.number}
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
