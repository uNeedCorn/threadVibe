"use client";

import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  label: string;
  size?: "sm" | "default" | "lg";
}

export function StatusBadge({ status, label, size = "default" }: StatusBadgeProps) {
  const baseClasses = "inline-flex items-center font-medium rounded-full";

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    default: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  const statusClasses = {
    normal: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    danger: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const colorClass = statusClasses[status as keyof typeof statusClasses] || statusClasses.normal;

  return (
    <span className={cn(baseClasses, sizeClasses[size], colorClass)}>
      {label}
    </span>
  );
}
