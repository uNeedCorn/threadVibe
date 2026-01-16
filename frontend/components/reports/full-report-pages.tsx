"use client";

import { forwardRef } from "react";
import {
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  Clock,
  Calendar,
  Target,
} from "lucide-react";
import type { FullReportSummary } from "@/hooks/use-full-report-data";

// 共用樣式
const PAGE_STYLE: React.CSSProperties = {
  width: "1920px",
  height: "1080px",
  backgroundColor: "#F8FAFC",
  fontFamily: "'Noto Sans TC', 'Inter', sans-serif",
  padding: "48px",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
};

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: "16px",
  padding: "24px",
  border: "1px solid #E2E8F0",
};

const PRIMARY_COLOR = "#E97A3B";
const TEXT_COLOR = "#0F172A";
const MUTED_COLOR = "#64748B";
const POSITIVE_COLOR = "#10B981";
const NEGATIVE_COLOR = "#EF4444";

// 格式化函數
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatPercent(num: number, showSign = true): string {
  const sign = showSign && num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(1)}%`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

// 頁面標題元件
function PageHeader({ title, subtitle, pageNum, totalPages }: {
  title: string;
  subtitle?: string;
  pageNum: number;
  totalPages: number;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
      <div>
        <h1 style={{ fontSize: "32px", fontWeight: 700, color: TEXT_COLOR, margin: 0 }}>{title}</h1>
        {subtitle && (
          <p style={{ fontSize: "16px", color: MUTED_COLOR, margin: "8px 0 0 0" }}>{subtitle}</p>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{
          padding: "8px 16px",
          backgroundColor: `${PRIMARY_COLOR}15`,
          borderRadius: "8px",
          color: PRIMARY_COLOR,
          fontWeight: 600,
          fontSize: "14px",
        }}>
          Postlyzer
        </div>
        <span style={{ fontSize: "14px", color: MUTED_COLOR }}>
          {pageNum} / {totalPages}
        </span>
      </div>
    </div>
  );
}

// 頁尾元件
function PageFooter({ accountUsername, periodStart, periodEnd }: {
  accountUsername: string;
  periodStart: Date;
  periodEnd: Date;
}) {
  return (
    <div style={{
      marginTop: "auto",
      paddingTop: "24px",
      borderTop: "1px solid #E2E8F0",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}>
      <p style={{ fontSize: "14px", color: MUTED_COLOR, margin: 0 }}>
        @{accountUsername} | {formatDate(periodStart)} - {formatDate(periodEnd)}
      </p>
      <p style={{ fontSize: "14px", color: MUTED_COLOR, margin: 0 }}>
        postlyzer.metricdesk.io
      </p>
    </div>
  );
}

// ==================== 第一頁：摘要 ====================
export const Page1Summary = forwardRef<HTMLDivElement, { data: FullReportSummary }>(
  ({ data }, ref) => {
    return (
      <div ref={ref} style={PAGE_STYLE}>
        <PageHeader
          title={`@${data.accountUsername} 成效報告`}
          subtitle={`${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`}
          pageNum={1}
          totalPages={5}
        />

        {/* 核心指標 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px", marginBottom: "32px" }}>
          <StatCard
            icon={<Users size={24} />}
            label="粉絲成長"
            value={data.followerGrowth >= 0 ? `+${formatNumber(data.followerGrowth)}` : formatNumber(data.followerGrowth)}
            change={data.followerGrowthRate}
          />
          <StatCard
            icon={<Eye size={24} />}
            label="總曝光數"
            value={formatNumber(data.totalViews)}
            change={data.viewsGrowthRate}
          />
          <StatCard
            icon={<Heart size={24} />}
            label="總互動數"
            value={formatNumber(data.totalInteractions)}
            change={data.interactionsGrowthRate}
          />
          <StatCard
            icon={<TrendingUp size={24} />}
            label="互動率"
            value={`${data.engagementRate.toFixed(2)}%`}
            change={data.engagementRateChange}
            isPercentChange
          />
        </div>

        {/* 主要內容 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flex: 1 }}>
          {/* 左側：Top 3 */}
          <div style={CARD_STYLE}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: TEXT_COLOR, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <TrendingUp size={20} color={PRIMARY_COLOR} /> Top 3 貼文
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {data.topPosts.slice(0, 3).map((post, idx) => (
                <PostItem key={post.id} post={post} rank={idx + 1} />
              ))}
            </div>
          </div>

          {/* 右側：分類 & 統計 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ ...CARD_STYLE, flex: 1 }}>
              <h2 style={{ fontSize: "18px", fontWeight: 600, color: TEXT_COLOR, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <BarChart3 size={20} color={PRIMARY_COLOR} /> 發文分類
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {data.categoryStats.slice(0, 4).map((cat) => (
                  <CategoryBar key={cat.name} category={cat} />
                ))}
                {data.categoryStats.length === 0 && (
                  <p style={{ color: MUTED_COLOR, textAlign: "center" }}>無分類數據</p>
                )}
              </div>
            </div>

            <div style={{ ...CARD_STYLE, display: "flex", gap: "24px" }}>
              <SummaryItem icon={<BarChart3 size={20} />} label="發文數" value={data.postCount.toString()} />
              <div style={{ width: "1px", backgroundColor: "#E2E8F0" }} />
              <SummaryItem icon={<Clock size={20} />} label="最佳時段" value={data.bestTimeSlot} />
              <div style={{ width: "1px", backgroundColor: "#E2E8F0" }} />
              <SummaryItem icon={<Users size={20} />} label="粉絲數" value={formatNumber(data.currentFollowers)} />
            </div>
          </div>
        </div>

        <PageFooter accountUsername={data.accountUsername} periodStart={data.periodStart} periodEnd={data.periodEnd} />
      </div>
    );
  }
);
Page1Summary.displayName = "Page1Summary";

// ==================== 第二頁：趨勢分析 ====================
export const Page2Trend = forwardRef<HTMLDivElement, { data: FullReportSummary }>(
  ({ data }, ref) => {
    const maxViews = Math.max(...data.trendData.map((d) => d.views), 1);
    const maxInteractions = Math.max(...data.trendData.map((d) => d.interactions), 1);

    return (
      <div ref={ref} style={PAGE_STYLE}>
        <PageHeader title="趨勢分析" subtitle="期間內的曝光與互動變化" pageNum={2} totalPages={5} />

        {/* 對比卡片 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginBottom: "32px" }}>
          <CompareCard
            label="曝光數"
            current={data.totalViews}
            previous={data.previousPeriod.totalViews}
          />
          <CompareCard
            label="互動數"
            current={data.totalInteractions}
            previous={data.previousPeriod.totalInteractions}
          />
          <CompareCard
            label="發文數"
            current={data.postCount}
            previous={data.previousPeriod.postCount}
          />
        </div>

        {/* 趨勢圖 */}
        <div style={{ ...CARD_STYLE, flex: 1 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 600, color: TEXT_COLOR, marginBottom: "24px" }}>
            每日曝光與互動趨勢
          </h2>

          {data.trendData.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "calc(100% - 60px)" }}>
              {/* 曝光趨勢 */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <Eye size={16} color={PRIMARY_COLOR} />
                  <span style={{ fontSize: "14px", color: MUTED_COLOR }}>曝光數</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "120px" }}>
                  {data.trendData.map((d, idx) => (
                    <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                      <div style={{
                        width: "100%",
                        maxWidth: "60px",
                        height: `${(d.views / maxViews) * 100}%`,
                        minHeight: "4px",
                        backgroundColor: PRIMARY_COLOR,
                        borderRadius: "4px 4px 0 0",
                      }} />
                      <span style={{ fontSize: "10px", color: MUTED_COLOR }}>{d.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 互動趨勢 */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <Heart size={16} color="#EC4899" />
                  <span style={{ fontSize: "14px", color: MUTED_COLOR }}>互動數</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "120px" }}>
                  {data.trendData.map((d, idx) => (
                    <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                      <div style={{
                        width: "100%",
                        maxWidth: "60px",
                        height: `${(d.interactions / maxInteractions) * 100}%`,
                        minHeight: "4px",
                        backgroundColor: "#EC4899",
                        borderRadius: "4px 4px 0 0",
                      }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", color: MUTED_COLOR }}>
              沒有趨勢數據
            </div>
          )}
        </div>

        <PageFooter accountUsername={data.accountUsername} periodStart={data.periodStart} periodEnd={data.periodEnd} />
      </div>
    );
  }
);
Page2Trend.displayName = "Page2Trend";

// ==================== 第三頁：貼文排行 ====================
export const Page3Posts = forwardRef<HTMLDivElement, { data: FullReportSummary }>(
  ({ data }, ref) => {
    return (
      <div ref={ref} style={PAGE_STYLE}>
        <PageHeader title="貼文排行" subtitle="依曝光數排序的 Top 10 貼文" pageNum={3} totalPages={5} />

        <div style={{ ...CARD_STYLE, flex: 1, overflow: "hidden" }}>
          {/* 表頭 */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr 100px 100px 100px 100px 100px",
            gap: "16px",
            padding: "12px 0",
            borderBottom: "2px solid #E2E8F0",
            fontWeight: 600,
            fontSize: "14px",
            color: MUTED_COLOR,
          }}>
            <div>排名</div>
            <div>貼文內容</div>
            <div style={{ textAlign: "right" }}>曝光</div>
            <div style={{ textAlign: "right" }}>讚</div>
            <div style={{ textAlign: "right" }}>回覆</div>
            <div style={{ textAlign: "right" }}>轉發</div>
            <div style={{ textAlign: "right" }}>互動率</div>
          </div>

          {/* 貼文列表 */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.topPosts.slice(0, 10).map((post, idx) => (
              <div
                key={post.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 100px 100px 100px 100px 100px",
                  gap: "16px",
                  padding: "16px 0",
                  borderBottom: "1px solid #E2E8F0",
                  alignItems: "center",
                }}
              >
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "8px",
                  backgroundColor: idx < 3 ? PRIMARY_COLOR : "#E2E8F0",
                  color: idx < 3 ? "white" : TEXT_COLOR,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "16px",
                }}>
                  {idx + 1}
                </div>
                <div>
                  <p style={{ fontSize: "14px", color: TEXT_COLOR, margin: 0, lineHeight: 1.4 }}>
                    {truncateText(post.text, 60)}
                  </p>
                  <p style={{ fontSize: "12px", color: MUTED_COLOR, margin: "4px 0 0 0" }}>
                    {formatDate(post.publishedAt)}
                    {post.tags.length > 0 && ` | ${post.tags.slice(0, 2).join(", ")}`}
                  </p>
                </div>
                <div style={{ textAlign: "right", fontSize: "14px", fontWeight: 600, color: TEXT_COLOR }}>
                  {formatNumber(post.views)}
                </div>
                <div style={{ textAlign: "right", fontSize: "14px", color: TEXT_COLOR }}>
                  {formatNumber(post.likes)}
                </div>
                <div style={{ textAlign: "right", fontSize: "14px", color: TEXT_COLOR }}>
                  {formatNumber(post.replies)}
                </div>
                <div style={{ textAlign: "right", fontSize: "14px", color: TEXT_COLOR }}>
                  {formatNumber(post.reposts)}
                </div>
                <div style={{ textAlign: "right", fontSize: "14px", fontWeight: 600, color: PRIMARY_COLOR }}>
                  {post.engagementRate.toFixed(2)}%
                </div>
              </div>
            ))}
            {data.topPosts.length === 0 && (
              <div style={{ padding: "48px", textAlign: "center", color: MUTED_COLOR }}>
                該期間沒有貼文
              </div>
            )}
          </div>
        </div>

        <PageFooter accountUsername={data.accountUsername} periodStart={data.periodStart} periodEnd={data.periodEnd} />
      </div>
    );
  }
);
Page3Posts.displayName = "Page3Posts";

// ==================== 第四頁：分類分析 ====================
export const Page4Categories = forwardRef<HTMLDivElement, { data: FullReportSummary }>(
  ({ data }, ref) => {
    return (
      <div ref={ref} style={PAGE_STYLE}>
        <PageHeader title="分類分析" subtitle="各標籤的發文數量與成效表現" pageNum={4} totalPages={5} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flex: 1 }}>
          {/* 左側：分類統計表 */}
          <div style={CARD_STYLE}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: TEXT_COLOR, marginBottom: "16px" }}>
              分類統計
            </h2>
            {data.categoryStats.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {data.categoryStats.map((cat, idx) => (
                  <div key={cat.name} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "12px",
                    backgroundColor: "#F8FAFC",
                    borderRadius: "8px",
                  }}>
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      backgroundColor: idx === 0 ? PRIMARY_COLOR : "#E2E8F0",
                      color: idx === 0 ? "white" : TEXT_COLOR,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: "14px",
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: TEXT_COLOR, margin: 0 }}>
                        {cat.name}
                      </p>
                      <p style={{ fontSize: "12px", color: MUTED_COLOR, margin: "2px 0 0 0" }}>
                        {cat.count} 篇 ({cat.percentage.toFixed(1)}%)
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: PRIMARY_COLOR, margin: 0 }}>
                        {cat.avgEngagementRate.toFixed(2)}%
                      </p>
                      <p style={{ fontSize: "12px", color: MUTED_COLOR, margin: "2px 0 0 0" }}>
                        平均互動率
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: MUTED_COLOR }}>
                尚未設定分類標籤
              </div>
            )}
          </div>

          {/* 右側：成效比較 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={CARD_STYLE}>
              <h2 style={{ fontSize: "18px", fontWeight: 600, color: TEXT_COLOR, marginBottom: "16px" }}>
                各分類曝光數
              </h2>
              {data.categoryStats.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {data.categoryStats.slice(0, 6).map((cat) => {
                    const maxViews = Math.max(...data.categoryStats.map((c) => c.totalViews), 1);
                    const width = (cat.totalViews / maxViews) * 100;
                    return (
                      <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ width: "80px", fontSize: "14px", color: TEXT_COLOR }}>{cat.name}</span>
                        <div style={{ flex: 1, height: "24px", backgroundColor: "#E2E8F0", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: `${width}%`,
                            backgroundColor: PRIMARY_COLOR,
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            paddingRight: "8px",
                          }}>
                            {width > 20 && (
                              <span style={{ fontSize: "12px", color: "white", fontWeight: 600 }}>
                                {formatNumber(cat.totalViews)}
                              </span>
                            )}
                          </div>
                        </div>
                        {width <= 20 && (
                          <span style={{ fontSize: "12px", color: TEXT_COLOR, fontWeight: 600, width: "60px" }}>
                            {formatNumber(cat.totalViews)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "150px", color: MUTED_COLOR }}>
                  無數據
                </div>
              )}
            </div>

            <div style={CARD_STYLE}>
              <h2 style={{ fontSize: "18px", fontWeight: 600, color: TEXT_COLOR, marginBottom: "16px" }}>
                各分類互動數
              </h2>
              {data.categoryStats.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {data.categoryStats.slice(0, 6).map((cat) => {
                    const maxInteractions = Math.max(...data.categoryStats.map((c) => c.totalInteractions), 1);
                    const width = (cat.totalInteractions / maxInteractions) * 100;
                    return (
                      <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span style={{ width: "80px", fontSize: "14px", color: TEXT_COLOR }}>{cat.name}</span>
                        <div style={{ flex: 1, height: "24px", backgroundColor: "#E2E8F0", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{
                            height: "100%",
                            width: `${width}%`,
                            backgroundColor: "#EC4899",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            paddingRight: "8px",
                          }}>
                            {width > 20 && (
                              <span style={{ fontSize: "12px", color: "white", fontWeight: 600 }}>
                                {formatNumber(cat.totalInteractions)}
                              </span>
                            )}
                          </div>
                        </div>
                        {width <= 20 && (
                          <span style={{ fontSize: "12px", color: TEXT_COLOR, fontWeight: 600, width: "60px" }}>
                            {formatNumber(cat.totalInteractions)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "150px", color: MUTED_COLOR }}>
                  無數據
                </div>
              )}
            </div>
          </div>
        </div>

        <PageFooter accountUsername={data.accountUsername} periodStart={data.periodStart} periodEnd={data.periodEnd} />
      </div>
    );
  }
);
Page4Categories.displayName = "Page4Categories";

// ==================== 第五頁：時段分析 ====================
export const Page5TimeAnalysis = forwardRef<HTMLDivElement, { data: FullReportSummary }>(
  ({ data }, ref) => {
    const maxPostCount = Math.max(...data.hourlyDistribution.map((h) => h.postCount), 1);
    const maxAvgViews = Math.max(...data.hourlyDistribution.map((h) => h.avgViews), 1);

    // 找出最佳時段
    const bestHours = [...data.hourlyDistribution]
      .filter((h) => h.postCount > 0)
      .sort((a, b) => b.avgViews - a.avgViews)
      .slice(0, 3);

    return (
      <div ref={ref} style={PAGE_STYLE}>
        <PageHeader title="時段分析" subtitle="發文時間分布與最佳發文時段建議" pageNum={5} totalPages={5} />

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", flex: 1 }}>
          {/* 左側：24小時分布圖 */}
          <div style={CARD_STYLE}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: TEXT_COLOR, marginBottom: "24px" }}>
              24 小時發文分布
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* 發文數 */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <Calendar size={16} color={PRIMARY_COLOR} />
                  <span style={{ fontSize: "14px", color: MUTED_COLOR }}>發文數量</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", height: "100px", gap: "2px" }}>
                  {data.hourlyDistribution.map((h) => (
                    <div
                      key={h.hour}
                      style={{
                        flex: 1,
                        height: `${(h.postCount / maxPostCount) * 100}%`,
                        minHeight: h.postCount > 0 ? "4px" : "2px",
                        backgroundColor: h.postCount > 0 ? PRIMARY_COLOR : "#E2E8F0",
                        borderRadius: "2px 2px 0 0",
                      }}
                      title={`${h.hour}:00 - ${h.postCount} 篇`}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  {[0, 6, 12, 18, 23].map((h) => (
                    <span key={h} style={{ fontSize: "10px", color: MUTED_COLOR }}>{h}:00</span>
                  ))}
                </div>
              </div>

              {/* 平均曝光 */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <Eye size={16} color="#3B82F6" />
                  <span style={{ fontSize: "14px", color: MUTED_COLOR }}>平均曝光數</span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", height: "100px", gap: "2px" }}>
                  {data.hourlyDistribution.map((h) => (
                    <div
                      key={h.hour}
                      style={{
                        flex: 1,
                        height: `${(h.avgViews / maxAvgViews) * 100}%`,
                        minHeight: h.avgViews > 0 ? "4px" : "2px",
                        backgroundColor: h.avgViews > 0 ? "#3B82F6" : "#E2E8F0",
                        borderRadius: "2px 2px 0 0",
                      }}
                      title={`${h.hour}:00 - 平均 ${formatNumber(h.avgViews)} 曝光`}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  {[0, 6, 12, 18, 23].map((h) => (
                    <span key={h} style={{ fontSize: "10px", color: MUTED_COLOR }}>{h}:00</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 右側：最佳時段建議 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={CARD_STYLE}>
              <h2 style={{ fontSize: "18px", fontWeight: 600, color: TEXT_COLOR, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Target size={20} color={PRIMARY_COLOR} /> 最佳發文時段
              </h2>

              {bestHours.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {bestHours.map((h, idx) => (
                    <div
                      key={h.hour}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "16px",
                        backgroundColor: idx === 0 ? `${PRIMARY_COLOR}10` : "#F8FAFC",
                        borderRadius: "12px",
                        border: idx === 0 ? `2px solid ${PRIMARY_COLOR}` : "none",
                      }}
                    >
                      <div style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        backgroundColor: idx === 0 ? PRIMARY_COLOR : "#E2E8F0",
                        color: idx === 0 ? "white" : TEXT_COLOR,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "18px",
                      }}>
                        {h.hour}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: "16px", fontWeight: 600, color: TEXT_COLOR, margin: 0 }}>
                          {h.hour}:00 - {(h.hour + 1) % 24}:00
                        </p>
                        <p style={{ fontSize: "12px", color: MUTED_COLOR, margin: "4px 0 0 0" }}>
                          {h.postCount} 篇貼文 | 平均 {formatNumber(h.avgViews)} 曝光
                        </p>
                      </div>
                      {idx === 0 && (
                        <div style={{
                          padding: "4px 12px",
                          backgroundColor: PRIMARY_COLOR,
                          color: "white",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}>
                          推薦
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "150px", color: MUTED_COLOR }}>
                  資料不足
                </div>
              )}
            </div>

            <div style={CARD_STYLE}>
              <h2 style={{ fontSize: "18px", fontWeight: 600, color: TEXT_COLOR, marginBottom: "16px" }}>
                發文摘要
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div style={{ textAlign: "center", padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "12px" }}>
                  <p style={{ fontSize: "32px", fontWeight: 700, color: TEXT_COLOR, margin: 0 }}>
                    {data.postCount}
                  </p>
                  <p style={{ fontSize: "14px", color: MUTED_COLOR, margin: "4px 0 0 0" }}>總發文數</p>
                </div>
                <div style={{ textAlign: "center", padding: "16px", backgroundColor: "#F8FAFC", borderRadius: "12px" }}>
                  <p style={{ fontSize: "32px", fontWeight: 700, color: PRIMARY_COLOR, margin: 0 }}>
                    {data.bestTimeSlot}
                  </p>
                  <p style={{ fontSize: "14px", color: MUTED_COLOR, margin: "4px 0 0 0" }}>最佳時段</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <PageFooter accountUsername={data.accountUsername} periodStart={data.periodStart} periodEnd={data.periodEnd} />
      </div>
    );
  }
);
Page5TimeAnalysis.displayName = "Page5TimeAnalysis";

// ==================== 輔助元件 ====================

function StatCard({ icon, label, value, change, isPercentChange = false }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: number;
  isPercentChange?: boolean;
}) {
  const isPositive = change >= 0;
  const changeColor = isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR;
  const ChangeIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <div style={{ color: PRIMARY_COLOR }}>{icon}</div>
        <span style={{ fontSize: "14px", color: MUTED_COLOR }}>{label}</span>
      </div>
      <p style={{ fontSize: "36px", fontWeight: 700, color: TEXT_COLOR, margin: 0 }}>{value}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "8px" }}>
        <ChangeIcon size={16} color={changeColor} />
        <span style={{ fontSize: "14px", color: changeColor, fontWeight: 500 }}>
          {isPercentChange ? formatPercent(change) : formatPercent(change)}
        </span>
        <span style={{ fontSize: "12px", color: MUTED_COLOR }}>vs 上期</span>
      </div>
    </div>
  );
}

function PostItem({ post, rank }: { post: FullReportSummary["topPosts"][0]; rank: number }) {
  return (
    <div style={{
      display: "flex",
      gap: "12px",
      padding: "12px",
      backgroundColor: "#F8FAFC",
      borderRadius: "8px",
    }}>
      <div style={{
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        backgroundColor: PRIMARY_COLOR,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: "16px",
        flexShrink: 0,
      }}>
        {rank}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "14px", color: TEXT_COLOR, margin: 0, lineHeight: 1.4 }}>
          {truncateText(post.text, 45)}
        </p>
        <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
          <span style={{ fontSize: "12px", color: MUTED_COLOR, display: "flex", alignItems: "center", gap: "4px" }}>
            <Eye size={14} /> {formatNumber(post.views)}
          </span>
          <span style={{ fontSize: "12px", color: MUTED_COLOR, display: "flex", alignItems: "center", gap: "4px" }}>
            <Heart size={14} /> {formatNumber(post.likes)}
          </span>
          <span style={{ fontSize: "12px", color: MUTED_COLOR, display: "flex", alignItems: "center", gap: "4px" }}>
            <MessageCircle size={14} /> {formatNumber(post.replies)}
          </span>
          <span style={{ fontSize: "12px", color: PRIMARY_COLOR, fontWeight: 600 }}>
            {post.engagementRate.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function CategoryBar({ category }: { category: FullReportSummary["categoryStats"][0] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
          <span style={{ fontSize: "14px", color: TEXT_COLOR }}>{category.name}</span>
          <span style={{ fontSize: "14px", color: MUTED_COLOR }}>{category.count} 篇</span>
        </div>
        <div style={{
          height: "8px",
          backgroundColor: "#E2E8F0",
          borderRadius: "4px",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${category.percentage}%`,
            backgroundColor: PRIMARY_COLOR,
            borderRadius: "4px",
          }} />
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ color: PRIMARY_COLOR }}>{icon}</span>
        <span style={{ fontSize: "14px", color: MUTED_COLOR }}>{label}</span>
      </div>
      <p style={{ fontSize: "24px", fontWeight: 700, color: TEXT_COLOR, margin: 0 }}>{value}</p>
    </div>
  );
}

function CompareCard({ label, current, previous }: { label: string; current: number; previous: number }) {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <div style={CARD_STYLE}>
      <p style={{ fontSize: "14px", color: MUTED_COLOR, margin: "0 0 8px 0" }}>{label}</p>
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
        <span style={{ fontSize: "32px", fontWeight: 700, color: TEXT_COLOR }}>
          {formatNumber(current)}
        </span>
        <span style={{ fontSize: "14px", color: isPositive ? POSITIVE_COLOR : NEGATIVE_COLOR }}>
          {formatPercent(change)}
        </span>
      </div>
      <p style={{ fontSize: "12px", color: MUTED_COLOR, margin: "8px 0 0 0" }}>
        上期：{formatNumber(previous)}
      </p>
    </div>
  );
}
