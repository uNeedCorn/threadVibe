import { RefreshCw, TrendingUp, Users, Sparkles } from "lucide-react";

const stats = [
  {
    icon: RefreshCw,
    value: "自動同步",
    label: "省去手動",
    description: "系統自動擷取成效數據",
  },
  {
    icon: TrendingUp,
    value: "完整紀錄",
    label: "歷史追蹤",
    description: "觀察長期成長趨勢",
  },
  {
    icon: Users,
    value: "多帳號",
    label: "集中管理",
    description: "輕鬆切換不同帳號",
  },
  {
    icon: Sparkles,
    value: "專為 Threads",
    label: "量身打造",
    description: "深度整合 Threads API",
  },
];

export function StatsSection() {
  return (
    <section className="py-12 md:py-16 border-y bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="inline-flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary mb-3">
                <stat.icon className="size-6" />
              </div>
              <div className="text-2xl md:text-3xl font-bold text-foreground">
                {stat.value}
              </div>
              <div className="text-sm font-medium text-foreground mt-1">
                {stat.label}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
