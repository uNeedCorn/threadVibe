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

export function trackEvent({ action, category, label, value }: GTagEvent) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
}

// 預定義的事件
export const AnalyticsEvents = {
  // Waitlist Modal 相關
  openWaitlistModal: (location: "hero" | "cta" | "navbar") =>
    trackEvent({
      action: "open_waitlist_modal",
      category: "engagement",
      label: location,
    }),

  submitWaitlist: (userType: string) =>
    trackEvent({
      action: "submit_waitlist",
      category: "conversion",
      label: userType,
    }),

  submitWaitlistSuccess: (isNewUser: boolean) =>
    trackEvent({
      action: "waitlist_success",
      category: "conversion",
      label: isNewUser ? "new_user" : "existing_user",
    }),
} as const;
