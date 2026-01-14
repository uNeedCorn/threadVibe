"use client";

import { SelectedAccountProvider as Provider } from "@/contexts/selected-account-context";

export function SelectedAccountProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Provider>{children}</Provider>;
}
