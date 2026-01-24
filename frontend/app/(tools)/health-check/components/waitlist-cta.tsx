"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, RefreshCw } from "lucide-react";
import { HealthCheckAnalytics } from "../lib/analytics";

const features = [
  { icon: BarChart3, text: "完整成效儀表板" },
  { icon: RefreshCw, text: "自動同步數據" },
];

export function WaitlistCta() {
  const handleClick = () => {
    HealthCheckAnalytics.clickWaitlist();
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="pt-6 text-center">
        <h3 className="text-xl font-semibold mb-2">
          想要更完整的數據追蹤？
        </h3>
        <p className="text-muted-foreground mb-6">
          Postlyzer 提供完整的 Threads 成效分析，自動追蹤每篇貼文表現
        </p>

        <div className="flex flex-wrap justify-center gap-4 mb-6">
          {features.map((feature) => (
            <div
              key={feature.text}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <feature.icon className="size-4 text-primary" />
              <span>{feature.text}</span>
            </div>
          ))}
        </div>

        <Button asChild size="lg" onClick={handleClick}>
          <Link href="https://postlyzer.metricdesk.io">
            申請試用 Postlyzer
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
