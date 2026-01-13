import { HelpCircle, Users, LineChart } from "lucide-react";

const painPoints = [
  {
    icon: HelpCircle,
    title: "發文後不知道成效？",
    description:
      "Threads 內建的分析功能有限，很難追蹤每篇貼文的表現和趨勢變化。",
  },
  {
    icon: Users,
    title: "團隊協作管理多帳號很麻煩？",
    description:
      "多人共同管理品牌帳號時，缺乏統一的工作區和權限管理機制。",
  },
  {
    icon: LineChart,
    title: "缺乏數據支撐內容決策？",
    description:
      "沒有歷史數據對比，無法分析什麼類型的內容最受歡迎、什麼時間發文效果最好。",
  },
];

export function PainPointsSection() {
  return (
    <section className="py-12 md:py-16 lg:py-24 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            你也遇到這些問題嗎？
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            經營 Threads 帳號時，這些常見痛點可能正在阻礙你的成長
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {painPoints.map((point, index) => (
            <div
              key={index}
              className="bg-card rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                <point.icon className="size-6" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {point.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {point.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
