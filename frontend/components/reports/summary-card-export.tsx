"use client";

import { forwardRef } from "react";
import { Eye, Heart, MessageCircle, Repeat2, Quote, TrendingUp, TrendingDown, Users, BarChart3, Clock } from "lucide-react";
import type { ReportSummary } from "@/hooks/use-report-data";

export type ReportTheme = "default" | "dark" | "blue" | "custom";

export interface ReportThemeColors {
  primary: string;
  primaryLight: string;
  background: string;
  cardBackground: string;
  text: string;
  textMuted: string;
  border: string;
  positive: string;
  negative: string;
}

const THEME_PRESETS: Record<Exclude<ReportTheme, "custom">, ReportThemeColors> = {
  default: {
    primary: "#14B8A6",
    primaryLight: "#CCFBF1",
    background: "#F8FAFC",
    cardBackground: "#FFFFFF",
    text: "#0F172A",
    textMuted: "#64748B",
    border: "#E2E8F0",
    positive: "#10B981",
    negative: "#EF4444",
  },
  dark: {
    primary: "#14B8A6",
    primaryLight: "#134E4A",
    background: "#0F172A",
    cardBackground: "#1E293B",
    text: "#F8FAFC",
    textMuted: "#94A3B8",
    border: "#334155",
    positive: "#10B981",
    negative: "#EF4444",
  },
  blue: {
    primary: "#3B82F6",
    primaryLight: "#DBEAFE",
    background: "#F8FAFC",
    cardBackground: "#FFFFFF",
    text: "#0F172A",
    textMuted: "#64748B",
    border: "#E2E8F0",
    positive: "#10B981",
    negative: "#EF4444",
  },
};

interface SummaryCardExportProps {
  data: ReportSummary;
  theme?: ReportTheme;
  customColor?: string;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPercent(num: number): string {
  return `${num >= 0 ? "+" : ""}${num.toFixed(1)}%`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export const SummaryCardExport = forwardRef<HTMLDivElement, SummaryCardExportProps>(
  ({ data, theme = "default", customColor }, ref) => {
    const colors = theme === "custom" && customColor
      ? { ...THEME_PRESETS.default, primary: customColor, primaryLight: `${customColor}20` }
      : THEME_PRESETS[theme as Exclude<ReportTheme, "custom">];

    const periodText = `${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`;

    return (
      <div
        ref={ref}
        style={{
          width: "1920px",
          height: "1080px",
          backgroundColor: colors.background,
          fontFamily: "'Noto Sans TC', 'Inter', sans-serif",
          padding: "48px",
          display: "flex",
          flexDirection: "column",
          gap: "32px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: colors.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BarChart3 size={28} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: "28px", fontWeight: 700, color: colors.text, margin: 0 }}>
                @{data.accountUsername} 成效報告
              </h1>
              <p style={{ fontSize: "16px", color: colors.textMuted, margin: 0 }}>
                {periodText}
              </p>
            </div>
          </div>
          <div
            style={{
              padding: "8px 16px",
              backgroundColor: colors.primaryLight,
              borderRadius: "8px",
              color: colors.primary,
              fontWeight: 600,
              fontSize: "14px",
            }}
          >
            Postlyzer
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px" }}>
          <StatCard
            icon={<Users size={24} />}
            label="粉絲成長"
            value={data.followerGrowth >= 0 ? `+${data.followerGrowth}` : `${data.followerGrowth}`}
            change={data.followerGrowthRate}
            colors={colors}
          />
          <StatCard
            icon={<Eye size={24} />}
            label="總曝光數"
            value={formatNumber(data.totalViews)}
            change={data.viewsGrowthRate}
            colors={colors}
          />
          <StatCard
            icon={<Heart size={24} />}
            label="總互動數"
            value={formatNumber(data.totalInteractions)}
            change={data.interactionsGrowthRate}
            colors={colors}
          />
          <StatCard
            icon={<TrendingUp size={24} />}
            label="互動率"
            value={`${data.engagementRate.toFixed(2)}%`}
            change={data.engagementRateChange}
            colors={colors}
            isPercentage
          />
        </div>

        {/* Main Content */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flex: 1 }}>
          {/* Top Posts */}
          <div
            style={{
              backgroundColor: colors.cardBackground,
              borderRadius: "16px",
              padding: "24px",
              border: `1px solid ${colors.border}`,
            }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: colors.text, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp size={24} color={colors.primary} /> Top 3 貼文
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {data.topPosts.map((post, idx) => (
                <div
                  key={post.id}
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "12px",
                    backgroundColor: colors.background,
                    borderRadius: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      backgroundColor: colors.primary,
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "16px",
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", color: colors.text, margin: 0, lineHeight: 1.4 }}>
                      「{truncateText(post.text, 45)}」
                    </p>
                    <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                      <MetricBadge icon={<Eye size={14} />} value={formatNumber(post.views)} colors={colors} />
                      <MetricBadge icon={<Heart size={14} />} value={formatNumber(post.likes)} colors={colors} />
                      <MetricBadge icon={<MessageCircle size={14} />} value={formatNumber(post.replies)} colors={colors} />
                      <MetricBadge icon={<Repeat2 size={14} />} value={formatNumber(post.reposts)} colors={colors} />
                      <span style={{ fontSize: "12px", color: colors.primary, fontWeight: 600 }}>
                        {post.engagementRate.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {data.topPosts.length === 0 && (
                <p style={{ color: colors.textMuted, textAlign: "center", padding: "24px" }}>
                  該期間沒有貼文
                </p>
              )}
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Category Stats */}
            <div
              style={{
                backgroundColor: colors.cardBackground,
                borderRadius: "16px",
                padding: "24px",
                border: `1px solid ${colors.border}`,
                flex: 1,
              }}
            >
              <h2 style={{ fontSize: "18px", fontWeight: 600, color: colors.text, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <BarChart3 size={24} color={colors.primary} /> 發文分類
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.categoryStats.slice(0, 4).map((cat) => (
                  <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "14px", color: colors.text }}>{cat.name}</span>
                        <span style={{ fontSize: "14px", color: colors.textMuted }}>{cat.count} 篇</span>
                      </div>
                      <div
                        style={{
                          height: "8px",
                          backgroundColor: colors.border,
                          borderRadius: "4px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${cat.percentage}%`,
                            backgroundColor: colors.primary,
                            borderRadius: "4px",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {data.categoryStats.length === 0 && (
                  <p style={{ color: colors.textMuted, textAlign: "center" }}>無分類數據</p>
                )}
              </div>
            </div>

            {/* Summary Stats */}
            <div
              style={{
                backgroundColor: colors.cardBackground,
                borderRadius: "16px",
                padding: "24px",
                border: `1px solid ${colors.border}`,
                display: "flex",
                gap: "24px",
              }}
            >
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "8px" }}>
                  <BarChart3 size={20} color={colors.primary} />
                  <span style={{ fontSize: "14px", color: colors.textMuted }}>發文數</span>
                </div>
                <p style={{ fontSize: "32px", fontWeight: 700, color: colors.text, margin: 0 }}>
                  {data.postCount}
                </p>
              </div>
              <div style={{ width: "1px", backgroundColor: colors.border }} />
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "8px" }}>
                  <Clock size={20} color={colors.primary} />
                  <span style={{ fontSize: "14px", color: colors.textMuted }}>最佳時段</span>
                </div>
                <p style={{ fontSize: "24px", fontWeight: 700, color: colors.text, margin: 0 }}>
                  {data.bestTimeSlot}
                </p>
              </div>
              <div style={{ width: "1px", backgroundColor: colors.border }} />
              <div style={{ flex: 1, textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "8px" }}>
                  <Users size={20} color={colors.primary} />
                  <span style={{ fontSize: "14px", color: colors.textMuted }}>粉絲數</span>
                </div>
                <p style={{ fontSize: "32px", fontWeight: 700, color: colors.text, margin: 0 }}>
                  {formatNumber(data.currentFollowers)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "16px",
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <p style={{ fontSize: "14px", color: colors.textMuted, margin: 0 }}>
            Postlyzer · 專為 Threads 創作者打造的成效分析工具
          </p>
          <p style={{ fontSize: "14px", color: colors.textMuted, margin: 0 }}>
            postlyzer.metricdesk.io
          </p>
        </div>
      </div>
    );
  }
);

SummaryCardExport.displayName = "SummaryCardExport";

// 統計卡片元件
function StatCard({
  icon,
  label,
  value,
  change,
  colors,
  isPercentage = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: number;
  colors: ReportThemeColors;
  isPercentage?: boolean;
}) {
  const isPositive = change >= 0;
  const changeColor = isPositive ? colors.positive : colors.negative;
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div
      style={{
        backgroundColor: colors.cardBackground,
        borderRadius: "16px",
        padding: "24px",
        border: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <div style={{ color: colors.primary }}>{icon}</div>
        <span style={{ fontSize: "14px", color: colors.textMuted }}>{label}</span>
      </div>
      <p style={{ fontSize: "36px", fontWeight: 700, color: colors.text, margin: 0 }}>{value}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "8px" }}>
        <ChangeIcon size={16} color={changeColor} />
        <span style={{ fontSize: "14px", color: changeColor, fontWeight: 500 }}>
          {isPercentage ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : formatPercent(change)}
        </span>
        <span style={{ fontSize: "12px", color: colors.textMuted }}>vs 上期</span>
      </div>
    </div>
  );
}

// 指標徽章元件
function MetricBadge({
  icon,
  value,
  colors,
}: {
  icon: React.ReactNode;
  value: string;
  colors: ReportThemeColors;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      <span style={{ color: colors.textMuted }}>{icon}</span>
      <span style={{ fontSize: "12px", color: colors.textMuted }}>{value}</span>
    </div>
  );
}
