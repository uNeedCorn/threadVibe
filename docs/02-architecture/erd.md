# ERD (Entity Relationship Diagram)

## 完整 ERD

```mermaid
erDiagram
    %% Core Entities
    users ||--o{ workspace_members : "has"
    users ||--o{ workspace_threads_tokens : "authorizes"
    users ||--o| user_subscriptions : "has"
    users ||--o| system_admins : "is"

    workspaces ||--o{ workspace_members : "has"
    workspaces ||--o{ workspace_threads_accounts : "has"

    workspace_members {
        uuid workspace_id PK,FK
        uuid user_id PK,FK
        enum role
        timestamp invited_at
        timestamp joined_at
    }

    %% Threads Account & Token
    workspace_threads_accounts ||--o{ workspace_threads_tokens : "has"
    workspace_threads_accounts ||--o{ workspace_threads_posts : "has"
    workspace_threads_accounts ||--o{ workspace_threads_account_insights : "has"
    workspace_threads_accounts ||--o{ sync_logs : "logs"

    workspace_threads_accounts {
        uuid id PK
        uuid workspace_id FK
        string threads_user_id
        string username
        boolean is_active
        timestamp created_at
    }

    workspace_threads_tokens {
        uuid id PK
        uuid workspace_threads_account_id FK
        uuid authorized_by_user_id FK
        text access_token_encrypted
        text refresh_token_encrypted
        timestamp expires_at
        boolean is_primary
        timestamp transfer_reminder_sent_at
        timestamp auto_revoke_at
        timestamp revoked_at
        timestamp created_at
    }

    %% Post & Metrics
    workspace_threads_posts ||--o{ workspace_threads_post_metrics : "has"

    workspace_threads_posts {
        uuid id PK
        uuid workspace_threads_account_id FK
        string threads_post_id
        text text
        string media_type
        string permalink
        timestamp published_at
        timestamp created_at
        timestamp updated_at
    }

    workspace_threads_post_metrics {
        uuid id PK
        uuid workspace_threads_post_id FK
        integer views
        integer likes
        integer replies
        integer reposts
        integer quotes
        integer shares
        timestamp captured_at
    }

    %% Account Insights
    workspace_threads_account_insights {
        uuid id PK
        uuid workspace_threads_account_id FK
        integer followers_count
        jsonb demographics
        timestamp captured_at
    }

    %% System Tables
    users {
        uuid id PK
        string email
        string name
        string avatar_url
        timestamp created_at
    }

    workspaces {
        uuid id PK
        string name
        uuid created_by_user_id FK
        timestamp deleted_at
        jsonb deletion_confirmed_by
        timestamp created_at
        timestamp updated_at
    }

    user_subscriptions {
        uuid id PK
        uuid user_id FK
        string plan_type
        jsonb limits
        timestamp valid_until
        timestamp created_at
    }

    sync_logs {
        uuid id PK
        uuid workspace_threads_account_id FK
        string job_type
        string status
        timestamp started_at
        timestamp completed_at
        text error_message
    }

    system_admins {
        uuid user_id PK,FK
        timestamp granted_at
    }
```

---

## 簡化關係圖

```mermaid
flowchart TB
    subgraph Auth
        U[users]
        SA[system_admins]
    end

    subgraph Workspace
        W[workspaces]
        WM[workspace_members]
    end

    subgraph Threads
        WTA[workspace_threads_accounts]
        WTT[workspace_threads_tokens]
    end

    subgraph Data
        WTP[workspace_threads_posts]
        WTPM[workspace_threads_post_metrics]
        WTAI[workspace_threads_account_insights]
    end

    subgraph System
        US[user_subscriptions]
        SL[sync_logs]
    end

    U --> WM
    U --> SA
    U --> WTT
    U --> US

    W --> WM
    W --> WTA

    WTA --> WTT
    WTA --> WTP
    WTA --> WTAI
    WTA --> SL

    WTP --> WTPM
```

---

## 主要關係說明

| 關係 | 類型 | 說明 |
|------|------|------|
| User → WorkspaceMember | 1:n | 一個用戶可加入多個 Workspace |
| Workspace → WorkspaceMember | 1:n | 一個 Workspace 有多個成員 |
| Workspace → ThreadsAccount | 1:n | 一個 Workspace 可綁定多個 Threads 帳號 |
| ThreadsAccount → Token | 1:n | 支援多 Token（移轉用） |
| ThreadsAccount → Post | 1:n | 一個帳號有多篇貼文 |
| Post → Metrics | 1:n | 每篇貼文有多筆成效快照 |
| User → Subscription | 1:1 | 每個用戶一個訂閱方案 |
