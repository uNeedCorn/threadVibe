"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import {
  Eye,
  Heart,
  MessageCircle,
  Users,
  TrendingUp,
  BarChart3,
} from "lucide-react";

// 假數據 - 7 天趨勢
const trendData = [
  { date: "1/6", views: 2400, likes: 180, comments: 24 },
  { date: "1/7", views: 3200, likes: 240, comments: 32 },
  { date: "1/8", views: 2800, likes: 210, comments: 28 },
  { date: "1/9", views: 4100, likes: 320, comments: 45 },
  { date: "1/10", views: 3800, likes: 290, comments: 38 },
  { date: "1/11", views: 5200, likes: 410, comments: 52 },
  { date: "1/12", views: 4800, likes: 380, comments: 48 },
];

// 假數據 - 粉絲成長
const followerData = [
  { date: "1/6", followers: 12340 },
  { date: "1/7", followers: 12380 },
  { date: "1/8", followers: 12420 },
  { date: "1/9", followers: 12510 },
  { date: "1/10", followers: 12580 },
  { date: "1/11", followers: 12720 },
  { date: "1/12", followers: 12850 },
];

// 假數據 - 熱門貼文
const topPosts = [
  { id: 1, preview: "分享一個提升效率的小技巧...", views: 5200, likes: 410 },
  { id: 2, preview: "今天學到的三個重要觀念...", views: 4100, likes: 320 },
  { id: 3, preview: "關於創作這件事，我想說...", views: 3800, likes: 290 },
];

function MiniKPICard({
  title,
  value,
  change,
  icon: Icon,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{title}</span>
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="text-lg font-bold">{value}</div>
      <div className="flex items-center gap-1 text-xs text-green-600">
        <TrendingUp className="size-3" />
        {change}
      </div>
    </div>
  );
}

export function DemoPreview() {
  return (
    <div className="relative mx-auto max-w-5xl px-4">
      {/* Browser Frame */}
      <div className="rounded-xl border bg-background shadow-2xl overflow-hidden">
        {/* Browser Header */}
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
          <div className="flex gap-1.5">
            <div className="size-3 rounded-full bg-red-400" />
            <div className="size-3 rounded-full bg-yellow-400" />
            <div className="size-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 rounded-md bg-background border px-3 py-1 text-xs text-muted-foreground">
              <BarChart3 className="size-3" />
              app.postlyzer.com/dashboard
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="p-4 md:p-6 bg-muted/30">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
              <div>
                <div className="font-semibold">@postlyzer_demo</div>
                <div className="text-xs text-muted-foreground">12.8K 粉絲</div>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              過去 7 天
            </Badge>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <MiniKPICard
              title="總觀看"
              value="26.3K"
              change="+18.5%"
              icon={Eye}
            />
            <MiniKPICard
              title="總愛心"
              value="2,030"
              change="+24.2%"
              icon={Heart}
            />
            <MiniKPICard
              title="總留言"
              value="267"
              change="+15.8%"
              icon={MessageCircle}
            />
            <MiniKPICard
              title="新粉絲"
              value="+510"
              change="+12.3%"
              icon={Users}
            />
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {/* Engagement Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">互動趨勢</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
                      />
                      <Line
                        type="monotone"
                        dataKey="views"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="likes"
                        stroke="#16a34a"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 mt-2 justify-center">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="size-2 rounded-full bg-blue-600" />
                    <span className="text-muted-foreground">觀看</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="size-2 rounded-full bg-green-600" />
                    <span className="text-muted-foreground">愛心</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Follower Growth */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">粉絲成長</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[140px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={followerData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        domain={['dataMin - 100', 'dataMax + 100']}
                        tickFormatter={(v) => `${(v/1000).toFixed(1)}K`}
                      />
                      <defs>
                        <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="followers"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        fill="url(#followerGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-center mt-2">
                  <span className="text-xs text-muted-foreground">
                    本週新增 <span className="text-purple-600 font-medium">+510</span> 位粉絲
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Posts */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">熱門貼文</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topPosts.map((post, index) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between rounded-lg border bg-background p-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {index + 1}
                      </span>
                      <span className="text-sm truncate max-w-[200px] md:max-w-none">
                        {post.preview}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="size-3" />
                        {(post.views / 1000).toFixed(1)}K
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="size-3" />
                        {post.likes}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute -z-10 -bottom-4 -right-4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute -z-10 -top-4 -left-4 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl" />
    </div>
  );
}
