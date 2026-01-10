# ThreadsVibe

Threads 發文成效儀表板 — 支援多用戶、多工作區、多帳號的團隊協作平台。

## 功能概述

- **Google 帳號登入** — 透過 Supabase Auth 進行身份驗證
- **Threads 帳號授權** — OAuth 連結 Threads API 取得貼文數據
- **多工作區管理** — 團隊協作、權限控管、資料隔離
- **成效追蹤** — 貼文曝光、互動、分享等指標視覺化
- **帳號 Insights** — 粉絲成長、受眾輪廓分析

## 技術架構

| 層級 | 技術 |
|------|------|
| 資料庫 | Supabase PostgreSQL |
| 後端 | Supabase Edge Functions (Deno/TypeScript) |
| 前端 | Next.js + TypeScript + Tailwind CSS |
| 認證 | Google OAuth + Threads OAuth |
| 外部 API | Threads Graph API (Meta) |

## 文件結構

```
docs/
├── 01-requirements/    # 需求文件
├── 02-architecture/    # 架構設計
├── 03-database/        # 資料庫規格
├── 04-backend/         # 後端規格
└── 05-frontend/        # 前端規格
```

## 核心概念

### Workspace（工作區）

資料隔離的基本單位。每個 Workspace 獨立管理：
- Threads 帳號連結
- 貼文與成效數據
- 成員權限

### 權限模型

| 角色 | 能力 |
|------|------|
| System Admin | 全系統管理 |
| Owner | Workspace 完整管理權 |
| Editor | 讀寫資料 |
| Viewer | 唯讀 |

### Token 管理

- Token 歸屬於 Workspace（非個人）
- 支援 Token 移轉（成員離開時）
- 同一帳號可有多個 Token（平滑交接）

## 快速開始

```bash
# 安裝依賴
cd frontend && npm install

# 啟動開發伺服器
npm run dev
```

## 環境變數

```bash
# Frontend (.env.local)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Edge Functions (supabase secrets)
THREADS_APP_ID=
THREADS_APP_SECRET=
```

## License

Private - All rights reserved
