import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDistanceToNow(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)

  if (months > 0) return `${months} 個月前`
  if (weeks > 0) return `${weeks} 週前`
  if (days > 0) return `${days} 天前`
  if (hours > 0) return `${hours} 小時前`
  if (minutes > 0) return `${minutes} 分鐘前`
  return "剛剛"
}
