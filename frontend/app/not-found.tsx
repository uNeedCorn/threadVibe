import Link from "next/link";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 text-center">
        {/* 404 Icon */}
        <div className="flex justify-center mb-6">
          <div className="size-20 rounded-full bg-muted flex items-center justify-center">
            <span className="text-3xl font-bold text-muted-foreground">404</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          找不到頁面
        </h1>
        <p className="text-muted-foreground mb-8">
          您要找的頁面不存在或已被移動。
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/">
              <Home className="mr-2 size-4" />
              回到首頁
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">
              <ArrowLeft className="mr-2 size-4" />
              前往登入
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
