import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { WaitlistModal } from "./waitlist-modal";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-32">
        <div className="flex flex-col items-center text-center space-y-8">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1 text-sm font-medium text-warning">
              <span className="size-2 rounded-full bg-warning animate-pulse" />
              Beta 測試中
            </span>
            <span className="text-sm text-muted-foreground">
              免費申請試用
            </span>
          </div>

          {/* Headline */}
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
              Threads 發了，然後呢？
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              自動追蹤每篇貼文成效，找出最佳發文時間
              <br className="hidden sm:block" />
              讓數據告訴你，哪篇貼文表現最好
            </p>
          </div>

          {/* Value Proposition */}
          <p className="text-base font-medium text-foreground">
            不用再手動截圖抄數據，一個平台搞定成效追蹤與分析
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <WaitlistModal
              trigger={
                <Button size="lg" className="text-base px-8">
                  申請試用
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              }
            />
            <Button asChild variant="outline" size="lg" className="text-base px-8">
              <a href="#features">
                查看功能
              </a>
            </Button>
          </div>
        </div>

      </div>
    </section>
  );
}
