import { BarChart3, Eye, Heart, MessageCircle, Repeat, TrendingUp } from "lucide-react";

const recentActivities = [
  { username: "創作者A", action: "觀看數突破", value: "10K", color: "bg-primary" },
  { username: "創作者B", action: "互動率創新高", value: "5.2%", color: "bg-emerald-500" },
  { username: "創作者C", action: "新增粉絲", value: "+128", color: "bg-orange-500" },
  { username: "創作者D", action: "熱門貼文", value: "#1", color: "bg-violet-500" },
];

export function ScreenshotSection() {
  return (
    <section className="py-12 md:py-16 lg:py-24 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            直覺的儀表板介面
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            一目了然的數據視覺化，讓你快速掌握帳號表現
          </p>
        </div>

        {/* Browser mockup */}
        <div className="relative max-w-5xl mx-auto">
          {/* Browser frame */}
          <div className="bg-card rounded-xl border shadow-2xl overflow-hidden">
            {/* Browser header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-destructive/60" />
                <div className="size-3 rounded-full bg-warning/60" />
                <div className="size-3 rounded-full bg-success/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 bg-background rounded-md text-xs text-muted-foreground">
                  app.postlyzer.com
                </div>
              </div>
            </div>

            {/* Dashboard mockup content */}
            <div className="p-6 bg-background">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <BarChart3 className="size-4" />
                  </div>
                  <span className="font-semibold text-foreground">
                    儀表板
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  最近 7 天
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "總觸及", value: "12.5K", icon: Eye, change: "+15%", trend: "up" },
                  { label: "互動數", value: "2,847", icon: Heart, change: "+8%", trend: "up" },
                  { label: "留言數", value: "156", icon: MessageCircle, change: "+23%", trend: "up" },
                  { label: "轉發數", value: "89", icon: Repeat, change: "+12%", trend: "up" },
                ].map((kpi, index) => (
                  <div
                    key={index}
                    className="bg-card rounded-lg border p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                      <kpi.icon className="size-4" />
                      {kpi.label}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-foreground">
                        {kpi.value}
                      </span>
                      <span className="flex items-center text-xs text-success">
                        <TrendingUp className="size-3 mr-0.5" />
                        {kpi.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart and Activity */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Chart */}
                <div className="md:col-span-2 bg-card rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm font-medium text-foreground">
                      觸及趨勢
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span className="px-2 py-0.5 rounded bg-muted">7天</span>
                      <span className="px-2 py-0.5 rounded hover:bg-muted cursor-pointer">30天</span>
                      <span className="px-2 py-0.5 rounded hover:bg-muted cursor-pointer">90天</span>
                    </div>
                  </div>
                  <div className="h-32 flex items-end justify-between gap-2">
                    {[40, 65, 45, 80, 55, 90, 70].map((height, index) => (
                      <div
                        key={index}
                        className="flex-1 bg-primary/20 rounded-t-sm relative group"
                        style={{ height: `${height}%` }}
                      >
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-sm transition-all group-hover:bg-primary/80"
                          style={{ height: `${height * 0.7}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>週一</span>
                    <span>週二</span>
                    <span>週三</span>
                    <span>週四</span>
                    <span>週五</span>
                    <span>週六</span>
                    <span>週日</span>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-card rounded-lg border p-4">
                  <div className="text-sm font-medium text-foreground mb-4">
                    最近動態
                  </div>
                  <div className="space-y-3">
                    {recentActivities.map((activity, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <div className={`size-8 rounded-full ${activity.color} text-white flex items-center justify-center text-xs font-medium`}>
                          {activity.username.slice(-1)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground truncate">
                            {activity.username}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {activity.action}
                          </div>
                        </div>
                        <div className="text-sm font-medium text-primary">
                          {activity.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
          <div className="absolute -top-4 -right-4 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        </div>
      </div>
    </section>
  );
}
