import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaSection() {
  return (
    <section className="py-12 md:py-16 lg:py-24 bg-primary/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            準備好提升你的 Threads 成效了嗎？
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            用數據驅動你的內容策略，幾分鐘內即可開始追蹤。
          </p>
          <div className="flex justify-center">
            <Button asChild size="lg" className="text-base px-8">
              <Link href="/login">
                立即開始
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
