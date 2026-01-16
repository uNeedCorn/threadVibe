import { RefreshCw, Layers, Clock, CalendarClock, TrendingUp } from "lucide-react";

const features = [
  {
    icon: RefreshCw,
    title: "自動追蹤成效",
    description:
      "不用再手動截圖抄數據。系統自動同步每篇貼文的觀看、按讚、留言、轉發數據。",
  },
  {
    icon: Clock,
    title: "找出最佳發文時機",
    description:
      "分析歷史貼文表現，告訴你哪個時段發文互動最好，讓每篇貼文都有好的起跑點。",
  },
  {
    icon: TrendingUp,
    title: "追蹤成長趨勢",
    description:
      "觀察貼文成效隨時間的變化，了解哪些內容有長尾效應，持續帶來曝光。",
  },
  {
    icon: CalendarClock,
    title: "排程發文",
    description:
      "提前安排好整週的貼文內容，設定時間自動發布，再也不用盯著時鐘等發文。",
  },
  {
    icon: Layers,
    title: "多帳號管理",
    description:
      "一次管理多個品牌或客戶的 Threads 帳號，快速切換、統一檢視所有成效數據。",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-12 md:py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            經營 Threads 更省力
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            從數據追蹤到排程發文，讓你專注在內容創作
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
