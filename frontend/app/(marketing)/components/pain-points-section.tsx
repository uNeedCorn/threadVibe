import { Camera, Clock, Layers } from "lucide-react";

const painPoints = [
  {
    icon: Camera,
    title: "還在截圖記錄數據？",
    description:
      "每次都要手動截圖、開試算表抄數字，花時間又容易出錯。",
  },
  {
    icon: Clock,
    title: "不知道什麼時候發文最好？",
    description:
      "憑感覺發文，不確定粉絲什麼時候最活躍，錯過黃金曝光時段。",
  },
  {
    icon: Layers,
    title: "管理多帳號要一直切換？",
    description:
      "經營多個品牌或客戶帳號，每次都要登出登入，效率超低。",
  },
];

export function PainPointsSection() {
  return (
    <section className="py-12 md:py-16 lg:py-24 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            經營 Threads 的日常困擾
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            這些事情是不是也讓你很頭痛？
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
