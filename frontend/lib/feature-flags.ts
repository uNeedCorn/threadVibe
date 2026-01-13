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

  /**
   * Beta 邀請碼機制
   *
   * - true: 新用戶首次登入需要輸入邀請碼
   * - false: 任何人都可以直接註冊
   *
   * 環境變數：NEXT_PUBLIC_REQUIRE_INVITATION_CODE
   *
   * 影響範圍：
   * - Login: 新用戶會導向邀請碼頁面
   * - OAuth callback: 檢測新用戶並重定向
   */
  requireInvitationCode: process.env.NEXT_PUBLIC_REQUIRE_INVITATION_CODE === 'true',
} as const;

/**
 * Feature flag 類型
 */
export type FeatureFlags = typeof featureFlags;
