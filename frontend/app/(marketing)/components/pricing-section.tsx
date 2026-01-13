import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "個人經營者",
    description: "適合剛起步的創作者",
    price: "敬請期待",
    priceNote: "Beta 測試中",
    features: [
      { text: "1 個 Threads 帳號" },
      { text: "貼文同步與數據追蹤" },
      { text: "基礎成效分析" },
      { text: "自定義標籤管理" },
      { text: "30 天資料保留" },
    ],
    cta: "立即開始",
    highlighted: false,
  },
  {
    name: "專業創作者",
    description: "適合認真經營的創作者",
    price: "敬請期待",
    priceNote: "Beta 測試中",
    features: [
      { text: "多個 Threads 帳號" },
      { text: "貼文同步與數據追蹤" },
      { text: "進階成效分析" },
      { text: "自定義標籤管理" },
      { text: "365 天資料保留" },
      { text: "AI 智慧標籤" },
      { text: "優先同步" },
    ],
    cta: "立即開始",
    highlighted: true,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-12 md:py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 text-orange-600 text-sm font-medium mb-4">
            Beta 測試中
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            選擇適合你的方案
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            正式定價即將公布，Beta 期間搶先體驗完整功能
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-card rounded-xl border p-6 ${
                plan.highlighted
                  ? "border-primary shadow-lg ring-1 ring-primary/20"
                  : ""
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                    推薦
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-foreground mb-1">
                  {plan.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {plan.description}
                </p>
                <div className="text-3xl font-bold text-foreground">
                  {plan.price}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {plan.priceNote}
                </p>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-center gap-3">
                    <Check className="size-5 text-primary shrink-0" />
                    <span className="text-foreground">{feature.text}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className="w-full"
                variant={plan.highlighted ? "default" : "outline"}
              >
                <Link href="/login">{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
