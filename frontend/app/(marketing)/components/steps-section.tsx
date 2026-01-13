const steps = [
  {
    number: 1,
    title: "連結帳號",
    description: "使用 Google 登入後，透過 OAuth 安全連結你的 Threads 帳號，整個過程不到一分鐘。",
  },
  {
    number: 2,
    title: "自動同步",
    description: "系統定期自動同步你的貼文數據，包含觀看數、互動數等關鍵指標。",
  },
  {
    number: 3,
    title: "分析優化",
    description: "透過儀表板掌握成效趨勢，找出最佳發文時間與內容類型，持續優化策略。",
  },
];

export function StepsSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            三步驟開始追蹤
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            不需要技術背景，幾分鐘就能設定完成
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step) => (
            <div key={step.number} className="text-center">
              <div className="inline-flex items-center justify-center size-14 rounded-full bg-foreground text-background text-xl font-bold mb-4">
                {step.number}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
