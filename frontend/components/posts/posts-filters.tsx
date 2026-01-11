"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface PostsFiltersValue {
  timeRange: string;
  mediaType: string;
}

interface PostsFiltersProps {
  filters: PostsFiltersValue;
  onFiltersChange: (filters: PostsFiltersValue) => void;
}

export function PostsFilters({ filters, onFiltersChange }: PostsFiltersProps) {
  const handleChange = (key: keyof PostsFiltersValue, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="flex items-center gap-4">
      {/* 時間範圍 */}
      <Select value={filters.timeRange} onValueChange={(v) => handleChange("timeRange", v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="時間範圍" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">最近 7 天</SelectItem>
          <SelectItem value="30d">最近 30 天</SelectItem>
          <SelectItem value="90d">最近 90 天</SelectItem>
          <SelectItem value="all">全部時間</SelectItem>
        </SelectContent>
      </Select>

      {/* 媒體類型 */}
      <Select value={filters.mediaType} onValueChange={(v) => handleChange("mediaType", v)}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="媒體類型" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          <SelectItem value="TEXT_POST">文字</SelectItem>
          <SelectItem value="IMAGE">圖片</SelectItem>
          <SelectItem value="VIDEO">影片</SelectItem>
          <SelectItem value="CAROUSEL_ALBUM">輪播</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
