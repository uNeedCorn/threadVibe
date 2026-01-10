"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DangerZoneSection() {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;

    setIsDeleting(true);
    // TODO: 實作刪除 Workspace API
    alert("刪除 Workspace...");
    setIsDeleting(false);
    setIsDeleteOpen(false);
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">危險區域</CardTitle>
        <CardDescription>
          以下操作不可逆，請謹慎操作
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div>
            <p className="font-medium">刪除 Workspace</p>
            <p className="text-sm text-muted-foreground">
              刪除後所有資料將無法恢復，包括貼文、成效數據等
            </p>
          </div>
          <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 size-4" />
                刪除
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>確定要刪除此 Workspace 嗎？</DialogTitle>
                <DialogDescription>
                  此操作不可逆。刪除後，所有相關的 Threads 帳號連結、貼文資料、成效數據都將被永久刪除。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="confirm">
                    請輸入 <span className="font-mono font-bold">DELETE</span> 確認刪除
                  </Label>
                  <Input
                    id="confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                  取消
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={confirmText !== "DELETE" || isDeleting}
                >
                  {isDeleting ? "刪除中..." : "確認刪除"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
