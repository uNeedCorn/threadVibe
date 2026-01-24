"use client";

import { cn } from "@/lib/utils";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface StatusBadgeProps {
  status: string;
  label: string;
  size?: "sm" | "default" | "lg";
  showIcon?: boolean;
}

const statusConfig = {
  normal: {
    icon: CheckCircle,
    bgClass: "bg-green-100 dark:bg-green-900/30",
    textClass: "text-green-800 dark:text-green-400",
    ringClass: "ring-green-500/20",
  },
  warning: {
    icon: AlertTriangle,
    bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
    textClass: "text-yellow-800 dark:text-yellow-400",
    ringClass: "ring-yellow-500/20",
  },
  danger: {
    icon: XCircle,
    bgClass: "bg-red-100 dark:bg-red-900/30",
    textClass: "text-red-800 dark:text-red-400",
    ringClass: "ring-red-500/20",
  },
};

export function StatusBadge({
  status,
  label,
  size = "default",
  showIcon = true,
}: StatusBadgeProps) {
  const baseClasses = "inline-flex items-center gap-1.5 font-medium rounded-full ring-2";

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    default: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  const iconSizes = {
    sm: "size-3",
    default: "size-3.5",
    lg: "size-4",
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.normal;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        baseClasses,
        sizeClasses[size],
        config.bgClass,
        config.textClass,
        config.ringClass
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {label}
    </span>
  );
}
