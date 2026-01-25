"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles, Eye, Lightbulb, FileEdit, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { typography, spacing } from "@/components/report-shared";
import type { PersonaReportContent } from "@/hooks/use-persona-report";

interface Props {
  personaImage: PersonaReportContent["persona_image"];
}

export function PersonaImageSection({ personaImage }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { tags, style_spectrum, perception_gap, uniqueness, bio_rewrite } = personaImage;

  // 光譜標籤
  const spectrumConfig = {
    professional_friendly: { left: "專業", right: "親民" },
    educational_entertaining: { left: "教育", right: "娛樂" },
    rational_emotional: { left: "理性", right: "感性" },
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            <span className={typography.cardTitle}>你的形象</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className={spacing.section}>
          {/* 形象標籤 */}
          <section>
            <h3 className={cn(typography.sectionTitle, "mb-4")}>形象標籤</h3>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  className={cn(
                    "text-sm px-3 py-1.5",
                    tag.type === "primary"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {tag.tag}
                </Badge>
              ))}
            </div>
          </section>

          {/* 風格光譜 */}
          <section>
            <h3 className={cn(typography.sectionTitle, "mb-4")}>風格光譜</h3>
            <div className="space-y-5">
              {Object.entries(style_spectrum).map(([key, spec]) => {
                const config = spectrumConfig[key as keyof typeof spectrumConfig];
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{config.left}</span>
                      <span className="font-medium text-foreground">{spec.label}</span>
                      <span className="text-muted-foreground">{config.right}</span>
                    </div>
                    <div className="relative h-3 rounded-full bg-muted">
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-primary shadow-md border-2 border-background"
                        style={{ left: `calc(${spec.value}% - 10px)` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 認知落差 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Eye className="size-5" />
              <h3 className={typography.sectionTitle}>認知落差分析</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
                <p className={cn(typography.label, "text-blue-600 mb-3")}>Bio 宣稱</p>
                <ul className={spacing.listCompact}>
                  {perception_gap.bio_claims.map((claim, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-blue-500 shrink-0 mt-1">•</span>
                      <span className={typography.body}>{claim}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
                <p className={cn(typography.label, "text-emerald-600 mb-3")}>內容展現</p>
                <ul className={spacing.listCompact}>
                  {perception_gap.content_shows.map((show, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 shrink-0 mt-1">•</span>
                      <span className={typography.body}>{show}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {perception_gap.mismatches.length > 0 && (
              <div className="space-y-3 mb-4">
                {perception_gap.mismatches.map((m, i) => (
                  <div key={i} className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold">{m.issue}</span>
                      <div className="flex gap-1.5">
                        {m.in_bio && <Badge variant="outline" className="text-xs bg-blue-50">Bio</Badge>}
                        {m.in_content && <Badge variant="outline" className="text-xs bg-emerald-50">內容</Badge>}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{m.suggestion}</p>
                  </div>
                ))}
              </div>
            )}

            <p className={typography.caption}>{perception_gap.analysis}</p>
          </section>

          {/* 獨特性 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="size-5" />
              <h3 className={typography.sectionTitle}>獨特性分析</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className={cn(typography.label, "text-muted-foreground mb-3")}>同類型帳號特徵</p>
                <ul className={spacing.listCompact}>
                  {uniqueness.common_accounts.map((item, i) => (
                    <li key={i} className={typography.caption}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
                <p className={cn(typography.label, "text-primary mb-3")}>你的差異化特色</p>
                <ul className={spacing.listCompact}>
                  {uniqueness.your_differentiators.map((item, i) => (
                    <li key={i} className={cn(typography.body, "font-medium")}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
              <p className={cn(typography.label, "text-blue-600 mb-2")}>定位建議</p>
              <p className={cn(typography.body, "text-blue-900")}>{uniqueness.positioning_suggestion}</p>
            </div>
          </section>

          {/* Bio 改寫建議 */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <FileEdit className="size-5" />
              <h3 className={typography.sectionTitle}>Bio 改寫建議</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-4">
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className={cn(typography.label, "text-muted-foreground mb-3")}>目前 Bio</p>
                <p className={cn(typography.body, "whitespace-pre-wrap")}>{bio_rewrite.current}</p>
              </div>
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                <p className={cn(typography.label, "text-primary mb-3")}>建議 Bio</p>
                <p className={cn(typography.body, "whitespace-pre-wrap font-medium")}>{bio_rewrite.suggested}</p>
              </div>
            </div>

            {bio_rewrite.improvements.length > 0 && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className={cn(typography.label, "text-muted-foreground mb-3")}>改善重點</p>
                <ul className={spacing.listCompact}>
                  {bio_rewrite.improvements.map((imp, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary shrink-0 mt-0.5">✓</span>
                      <span className={typography.body}>{imp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </CardContent>
      )}
    </Card>
  );
}
