"use client";

import { ExternalLink, Image as ImageIcon, Video, FileText, Images } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface PostHeaderProps {
  post: {
    text: string | null;
    media_type: "TEXT_POST" | "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
    media_url: string | null;
    permalink: string;
    published_at: string;
    account: {
      username: string;
      profile_pic_url: string | null;
    };
  };
}

export function PostHeader({ post }: PostHeaderProps) {
  const getMediaIcon = (type: PostHeaderProps["post"]["media_type"]) => {
    switch (type) {
      case "IMAGE":
        return <ImageIcon className="size-5 text-muted-foreground" />;
      case "VIDEO":
        return <Video className="size-5 text-muted-foreground" />;
      case "CAROUSEL_ALBUM":
        return <Images className="size-5 text-muted-foreground" />;
      default:
        return <FileText className="size-5 text-muted-foreground" />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex gap-4">
          {/* 媒體縮圖 */}
          {post.media_url ? (
            <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted">
              <img
                src={post.media_url}
                alt=""
                className="size-full object-cover"
              />
              <div className="absolute bottom-1 right-1 rounded bg-black/50 p-1">
                {getMediaIcon(post.media_type)}
              </div>
            </div>
          ) : (
            <div className="flex size-24 shrink-0 items-center justify-center rounded-lg bg-muted">
              {getMediaIcon(post.media_type)}
            </div>
          )}

          {/* 內容 */}
          <div className="min-w-0 flex-1 space-y-3">
            {/* 貼文文字 */}
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {post.text || "（無文字內容）"}
            </p>

            {/* 發布資訊 */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Avatar className="size-5">
                  <AvatarImage src={post.account.profile_pic_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {post.account.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>@{post.account.username}</span>
              </div>
              <span>·</span>
              <span>{formatDate(post.published_at)}</span>
            </div>

            {/* 開啟 Threads */}
            <Button variant="outline" size="sm" asChild>
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 size-4" />
                在 Threads 開啟
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
