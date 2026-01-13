"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";

interface WaitlistModalProps {
  trigger?: React.ReactNode;
  buttonVariant?: "default" | "outline";
  buttonSize?: "default" | "lg";
  buttonClassName?: string;
}

type SubmitStatus = "idle" | "submitting" | "success" | "already_exists" | "error";
type UserType = "personal" | "agency" | "brand" | "";

const USER_TYPE_OPTIONS = [
  { value: "personal", label: "個人創作者" },
  { value: "agency", label: "代理商/小編" },
  { value: "brand", label: "品牌/企業" },
];

export function WaitlistModal({
  trigger,
  buttonVariant = "default",
  buttonSize = "lg",
  buttonClassName = "",
}: WaitlistModalProps) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // 表單欄位
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [threadsUsername, setThreadsUsername] = useState("");
  const [userType, setUserType] = useState<UserType>("");
  const [managedAccounts, setManagedAccounts] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    // 驗證 Gmail
    const emailTrimmed = email.trim().toLowerCase();
    if (!emailTrimmed.endsWith("@gmail.com")) {
      setErrorMessage("目前僅支援 Gmail 登入，請使用 Gmail 信箱");
      setStatus("error");
      return;
    }

    // 驗證必填欄位
    if (!threadsUsername.trim()) {
      setErrorMessage("請輸入您的 Threads 帳號");
      setStatus("error");
      return;
    }

    if (!userType) {
      setErrorMessage("請選擇身份類型");
      setStatus("error");
      return;
    }

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailTrimmed,
          name: name.trim() || null,
          threadsUsername: threadsUsername.trim(),
          userType,
          managedAccounts: managedAccounts.trim() || null,
          reason: reason.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "INVALID_EMAIL") {
          setErrorMessage("請輸入有效的 Email 地址");
        } else if (data.error === "EMAIL_REQUIRED") {
          setErrorMessage("請輸入 Email 地址");
        } else {
          setErrorMessage("送出失敗，請稍後再試");
        }
        setStatus("error");
        return;
      }

      if (data.alreadyExists) {
        setStatus("already_exists");
      } else {
        setStatus("success");
      }
    } catch {
      setErrorMessage("網路錯誤，請稍後再試");
      setStatus("error");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // 關閉時重置表單（但保留成功狀態讓用戶看到）
      if (status !== "success" && status !== "already_exists") {
        setStatus("idle");
        setErrorMessage("");
      }
    }
  };

  const resetAndClose = () => {
    setOpen(false);
    setStatus("idle");
    setEmail("");
    setName("");
    setThreadsUsername("");
    setUserType("");
    setManagedAccounts("");
    setReason("");
    setErrorMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant={buttonVariant} size={buttonSize} className={buttonClassName}>
            申請試用
            <ArrowRight className="ml-2 size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {status === "success" || status === "already_exists" ? (
          // 成功畫面
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-4 rounded-full bg-green-100 p-3">
              <CheckCircle2 className="size-8 text-green-600" />
            </div>
            <DialogTitle className="mb-2 text-xl">
              {status === "already_exists" ? "您已在等待名單中" : "申請已送出！"}
            </DialogTitle>
            <DialogDescription className="mb-6">
              {status === "already_exists"
                ? "我們已收到您的申請，請耐心等候審核通知。"
                : "感謝您的申請！我們會盡快審核並透過 Email 通知您。"}
            </DialogDescription>
            <Button onClick={resetAndClose}>
              好的
            </Button>
          </div>
        ) : (
          // 表單畫面
          <>
            <DialogHeader>
              <DialogTitle>申請加入 Beta 測試</DialogTitle>
              <DialogDescription>
                填寫以下資料，我們會盡快審核您的申請。
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === "submitting"}
                />
                <p className="text-xs text-muted-foreground">
                  目前僅支援 Gmail 登入
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">姓名</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="您的姓名（選填）"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={status === "submitting"}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="threads">
                  您的 Threads 帳號 <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="threads"
                    type="text"
                    placeholder="your_threads_username"
                    value={threadsUsername}
                    onChange={(e) => setThreadsUsername(e.target.value.replace(/^@/, ""))}
                    className="pl-8"
                    required
                    disabled={status === "submitting"}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  用於審核身份，請填寫您本人的 Threads 帳號
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="userType">
                  身份類型 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={userType}
                  onValueChange={(v) => setUserType(v as UserType)}
                  disabled={status === "submitting"}
                >
                  <SelectTrigger id="userType">
                    <SelectValue placeholder="請選擇身份類型" />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="managedAccounts">管理的 Threads 帳號</Label>
                <Input
                  id="managedAccounts"
                  type="text"
                  placeholder="@account1,@account2,@account3"
                  value={managedAccounts}
                  onChange={(e) => setManagedAccounts(e.target.value)}
                  disabled={status === "submitting"}
                />
                <p className="text-xs text-muted-foreground">
                  請輸入 @ID，用「,」分開，中間不要有空格
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">申請原因</Label>
                <Textarea
                  id="reason"
                  placeholder="為什麼想試用 ThreadsVibe？（選填）"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  disabled={status === "submitting"}
                />
              </div>

              {errorMessage && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={status === "submitting"}
                >
                  取消
                </Button>
                <Button type="submit" disabled={status === "submitting"}>
                  {status === "submitting" ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      送出中...
                    </>
                  ) : (
                    "送出申請"
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
