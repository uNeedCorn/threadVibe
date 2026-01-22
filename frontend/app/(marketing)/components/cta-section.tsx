import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { WaitlistModal } from "./waitlist-modal";

export function CtaSection() {
  return (
    <section className="py-12 md:py-16 lg:py-24 bg-primary/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            免費試用，看看你的貼文數據
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            3 分鐘完成設定，馬上開始追蹤成效
          </p>
          <div className="flex justify-center">
            <WaitlistModal
              location="cta"
              trigger={
                <Button size="lg" className="text-base px-8">
                  申請試用
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </section>
  );
}
