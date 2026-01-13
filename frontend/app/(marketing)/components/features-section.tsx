import { RefreshCw, Users, BarChart3, Layers } from "lucide-react";

const features = [
  {
    icon: RefreshCw,
    title: "自動數據同步",
    description:
      "自動從 Threads API 同步最新數據，追蹤貼文成效變化，掌握即時趨勢。",
  },
  {
    icon: BarChart3,
    title: "深度分析",
    description:
      "完整的成效指標視覺化：觸及率、互動率、粉絲成長趨勢。歷史數據對比，洞察內容表現。",
  },
  {
    icon: Layers,
    title: "多帳號管理",
    description:
      "一站式管理所有 Threads 帳號。輕鬆切換、統一檢視，適合品牌與創作者使用。",
  },
  {
    icon: Users,
    title: "持續進化",
    description:
      "我們持續聆聽創作者需求，不斷優化功能。打造最貼近你需要的 Threads 分析體驗。",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-12 md:py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            Postlyzer 幫你解決
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            專為 Threads 創作者打造的成效分析工具，讓數據說話
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-card rounded-xl border p-6 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <feature.icon className="size-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
