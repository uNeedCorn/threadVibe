/**
 * Health Check 頁面的 GA 追蹤事件
 */

type GTagEvent = {
  action: string;
  category: string;
  label?: string;
  value?: number;
};

declare global {
  interface Window {
    gtag?: (
      command: "event",
      action: string,
      params?: {
        event_category?: string;
        event_label?: string;
        value?: number;
      }
    ) => void;
  }
}

function trackEvent({ action, category, label, value }: GTagEvent) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
}

export const HealthCheckAnalytics = {
  // 進入未登入頁面
  viewLanding: () =>
    trackEvent({
      action: "health_check_view_landing",
      category: "page_view",
    }),

  // 點擊登入按鈕
  clickLogin: () =>
    trackEvent({
      action: "health_check_click_login",
      category: "engagement",
    }),

  // 開始填寫表單
  startForm: () =>
    trackEvent({
      action: "health_check_start_form",
      category: "engagement",
    }),

  // 提交檢測（主轉換）
  submit: (postCount: number) =>
    trackEvent({
      action: "health_check_submit",
      category: "conversion",
      value: postCount,
    }),

  // 查看結果
  viewResult: (status: string) =>
    trackEvent({
      action: "health_check_view_result",
      category: "engagement",
      label: status,
    }),

  // 點擊等待名單 CTA
  clickWaitlist: () =>
    trackEvent({
      action: "health_check_click_waitlist",
      category: "conversion",
    }),

  // 點擊再測一次
  clickAgain: () =>
    trackEvent({
      action: "health_check_click_again",
      category: "engagement",
    }),

  // 達到每日上限
  rateLimited: () =>
    trackEvent({
      action: "health_check_rate_limited",
      category: "error",
    }),
} as const;
