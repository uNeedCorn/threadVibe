"use client";

import { useCurrentUser } from "@/hooks/use-current-user";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldX, Loader2 } from "lucide-react";

interface AdminOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * 權限控制元件：只允許系統管理員存取
 *
 * 使用方式：
 * <AdminOnly>
 *   <YourAdminContent />
 * </AdminOnly>
 */
export function AdminOnly({ children, fallback }: AdminOnlyProps) {
  const { isAdmin, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      fallback ?? (
        <div className="flex h-64 items-center justify-center">
          <Alert variant="destructive" className="max-w-md">
            <ShieldX className="size-4" />
            <AlertTitle>權限不足</AlertTitle>
            <AlertDescription>
              此頁面僅限系統管理員存取。如需存取權限，請聯繫管理員。
            </AlertDescription>
          </Alert>
        </div>
      )
    );
  }

  return <>{children}</>;
}
