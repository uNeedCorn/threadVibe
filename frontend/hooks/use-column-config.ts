"use client";

import { useState, useEffect, useCallback } from "react";

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width: number;
  order: number;
  locked?: boolean; // 鎖定不可隱藏
}

export interface ColumnConfigState {
  columns: ColumnConfig[];
  version: number;
}

const STORAGE_KEY = "posts-table-columns";
const CONFIG_VERSION = 1;

// 預設欄位配置
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: "content", label: "內容", visible: true, width: 400, order: 0, locked: true },
  { id: "published_at", label: "發布時間", visible: true, width: 100, order: 1 },
  { id: "tags", label: "標籤", visible: true, width: 120, order: 2 },
  { id: "ai_tags", label: "AI 標籤", visible: true, width: 220, order: 3 },
  { id: "views", label: "觀看", visible: true, width: 80, order: 4 },
  { id: "likes", label: "讚", visible: true, width: 80, order: 5 },
  { id: "replies", label: "回覆", visible: true, width: 80, order: 6 },
  { id: "reposts", label: "轉發", visible: true, width: 80, order: 7 },
  { id: "quotes", label: "引用", visible: true, width: 80, order: 8 },
  { id: "engagement_rate", label: "互動率", visible: true, width: 70, order: 9 },
  { id: "reply_rate", label: "回覆率", visible: false, width: 70, order: 10 },
  { id: "repost_rate", label: "轉發率", visible: false, width: 70, order: 11 },
  { id: "quote_rate", label: "引用率", visible: false, width: 70, order: 12 },
  { id: "virality_score", label: "傳播力", visible: false, width: 70, order: 13 },
];

export function useColumnConfig() {
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [isLoaded, setIsLoaded] = useState(false);

  // 從 localStorage 載入配置
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: ColumnConfigState = JSON.parse(stored);

        // 版本檢查，如果版本不同則使用預設
        if (parsed.version === CONFIG_VERSION && parsed.columns) {
          // 建立 DEFAULT_COLUMNS 的 locked 屬性映射
          const defaultLockedMap = new Map(
            DEFAULT_COLUMNS.map(c => [c.id, c.locked])
          );

          // 合併新增的欄位（可能有新欄位加入）
          const storedIds = new Set(parsed.columns.map(c => c.id));
          const newColumns = DEFAULT_COLUMNS.filter(c => !storedIds.has(c.id));

          // 移除已刪除的欄位，並確保 locked 屬性從 DEFAULT_COLUMNS 取得
          const validIds = new Set(DEFAULT_COLUMNS.map(c => c.id));
          const validColumns = parsed.columns
            .filter(c => validIds.has(c.id))
            .map(c => ({
              ...c,
              locked: defaultLockedMap.get(c.id), // 從預設配置取得 locked 狀態
            }));

          setColumns([...validColumns, ...newColumns].sort((a, b) => a.order - b.order));
        }
      }
    } catch (e) {
      console.error("Failed to load column config:", e);
    }
    setIsLoaded(true);
  }, []);

  // 保存到 localStorage
  const saveConfig = useCallback((newColumns: ColumnConfig[]) => {
    const state: ColumnConfigState = {
      columns: newColumns,
      version: CONFIG_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, []);

  // 切換欄位可見性
  const toggleColumn = useCallback((columnId: string) => {
    setColumns(prev => {
      const column = prev.find(col => col.id === columnId);
      // 如果欄位被鎖定，不允許隱藏
      if (column?.locked) return prev;

      const newColumns = prev.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      );
      saveConfig(newColumns);
      return newColumns;
    });
  }, [saveConfig]);

  // 更新欄位寬度
  const updateWidth = useCallback((columnId: string, width: number) => {
    setColumns(prev => {
      const newColumns = prev.map(col =>
        col.id === columnId ? { ...col, width: Math.max(50, width) } : col
      );
      saveConfig(newColumns);
      return newColumns;
    });
  }, [saveConfig]);

  // 重新排序欄位
  const reorderColumns = useCallback((activeId: string, overId: string) => {
    setColumns(prev => {
      const activeIndex = prev.findIndex(col => col.id === activeId);
      const overIndex = prev.findIndex(col => col.id === overId);

      if (activeIndex === -1 || overIndex === -1) return prev;

      const newColumns = [...prev];
      const [removed] = newColumns.splice(activeIndex, 1);
      newColumns.splice(overIndex, 0, removed);

      // 更新 order
      const reordered = newColumns.map((col, index) => ({ ...col, order: index }));
      saveConfig(reordered);
      return reordered;
    });
  }, [saveConfig]);

  // 重置為預設
  const resetToDefault = useCallback(() => {
    setColumns(DEFAULT_COLUMNS);
    saveConfig(DEFAULT_COLUMNS);
  }, [saveConfig]);

  // 取得可見欄位（按 order 排序）
  const visibleColumns = columns
    .filter(col => col.visible)
    .sort((a, b) => a.order - b.order);

  return {
    columns,
    visibleColumns,
    isLoaded,
    toggleColumn,
    updateWidth,
    reorderColumns,
    resetToDefault,
  };
}
