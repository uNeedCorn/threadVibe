/**
 * Feature Flags 配置
 *
 * 集中管理所有功能開關，方便未來擴展功能時快速開啟。
 *
 * 使用方式：
 * ```tsx
 * import { featureFlags } from '@/lib/feature-flags';
 *
 * if (featureFlags.workspaceTeamMode) {
 *   // 顯示團隊功能
 * }
 * ```
 */

export const featureFlags = {
  /**
   * Workspace 團隊模式
   *
   * - true: 顯示完整 workspace 功能（切換、設定、成員管理）
   * - false: 個人模式，隱藏 workspace 相關 UI
   *
   * 影響範圍：
   * - Sidebar: WorkspaceSwitcher
   * - Settings: WorkspaceSettingsSection, MembersSection, DangerZoneSection
   */
  workspaceTeamMode: false,
} as const;

/**
 * Feature flag 類型
 */
export type FeatureFlags = typeof featureFlags;
