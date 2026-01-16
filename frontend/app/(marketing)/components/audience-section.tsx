import { User, Briefcase, Users } from "lucide-react";

const audiences = [
  {
    icon: User,
    title: "自媒體創作者",
    description: "想知道哪篇貼文最受歡迎，用數據優化內容策略，讓粉絲持續成長。",
  },
  {
    icon: Briefcase,
    title: "品牌社群小編",
    description: "追蹤每篇貼文成效，掌握數據變化，隨時回答主管的問題。",
  },
  {
    icon: Users,
    title: "社群顧問",
    description: "同時經營多個客戶帳號，一個平台快速切換，所有數據一目了然。",
  },
];

export function AudienceSection() {
  return (
    <section className="py-12 md:py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
            誰適合使用？
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            不管你是個人經營還是幫客戶操盤，Postlyzer 都能幫你省時間
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {audiences.map((audience, index) => (
            <div
              key={index}
              className="text-center p-6"
            >
              <div className="inline-flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <audience.icon className="size-8" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {audience.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {audience.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
