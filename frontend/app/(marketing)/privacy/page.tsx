import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "隱私政策 - Postlyzer",
  description: "了解 Postlyzer 如何收集、使用和保護您的個人資料",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="size-4" />
          返回首頁
        </Link>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>隱私政策</h1>
          <p className="lead">
            最後更新日期：2025 年 1 月
          </p>

          <p>
            歡迎使用 Postlyzer（以下簡稱「本服務」）。我們重視您的隱私，並致力於保護您的個人資料。本隱私政策說明我們如何收集、使用、儲存和保護您的資訊。
          </p>

          <h2>1. 資料收集</h2>
          <p>當您使用本服務時，我們可能收集以下類型的資料：</p>

          <h3>1.1 您主動提供的資料</h3>
          <ul>
            <li>透過 Google OAuth 登入時的基本資料（姓名、電子郵件）</li>
            <li>透過 Threads OAuth 授權時的帳號資料</li>
          </ul>

          <h3>1.2 自動收集的資料</h3>
          <ul>
            <li>您的 Threads 貼文內容與成效數據（觀看數、互動數等）</li>
            <li>服務使用記錄與操作日誌</li>
            <li>裝置資訊與瀏覽器類型</li>
          </ul>

          <h2>2. 資料使用</h2>
          <p>我們收集的資料將用於以下目的：</p>
          <ul>
            <li>提供、維護和改善本服務</li>
            <li>分析您的 Threads 貼文成效</li>
            <li>產生數據報表和洞察</li>
            <li>與您溝通服務相關事項</li>
            <li>偵測和防止詐欺或濫用行為</li>
          </ul>

          <h2>3. 資料分享</h2>
          <p>我們不會出售您的個人資料。在以下情況下，我們可能會分享您的資料：</p>
          <ul>
            <li><strong>服務供應商：</strong>與協助我們營運服務的第三方（如雲端服務供應商）分享</li>
            <li><strong>法律要求：</strong>依法律規定或政府機關要求時</li>
            <li><strong>業務轉讓：</strong>在合併、收購或資產出售的情況下</li>
          </ul>

          <h2>4. 第三方服務</h2>
          <p>本服務整合以下第三方服務：</p>
          <ul>
            <li><strong>Google：</strong>用於帳號驗證（OAuth 2.0）</li>
            <li><strong>Meta / Threads：</strong>用於存取您的 Threads 帳號資料</li>
            <li><strong>Supabase：</strong>用於資料儲存與驗證</li>
            <li><strong>Cloudflare Turnstile：</strong>用於防止機器人濫用</li>
          </ul>
          <p>這些服務有各自的隱私政策，建議您另行查閱。</p>

          <h2>5. 資料安全</h2>
          <p>我們採取適當的技術和組織措施來保護您的資料，包括：</p>
          <ul>
            <li>使用 HTTPS 加密傳輸</li>
            <li>存取權限控管</li>
            <li>定期安全審查</li>
          </ul>
          <p>然而，沒有任何網路傳輸或儲存方式是完全安全的，我們無法保證絕對的安全性。</p>

          <h2>6. 資料保留</h2>
          <p>
            我們會在提供服務所需的期間內保留您的資料。當您刪除帳號時，我們將在合理期間內刪除或匿名化您的個人資料，但可能因法律要求保留部分資料。
          </p>

          <h2>7. 您的權利</h2>
          <p>根據適用法律，您可能享有以下權利：</p>
          <ul>
            <li>存取您的個人資料</li>
            <li>更正不準確的資料</li>
            <li>刪除您的資料</li>
            <li>撤回同意</li>
            <li>資料可攜性</li>
          </ul>
          <p>如需行使這些權利，請透過下方聯絡方式與我們聯繫。</p>

          <h2>8. Cookie 使用</h2>
          <p>
            本服務使用 Cookie 和類似技術來維持您的登入狀態和改善使用體驗。您可以透過瀏覽器設定管理 Cookie 偏好，但這可能影響部分功能的使用。
          </p>

          <h2>9. 兒童隱私</h2>
          <p>
            本服務不適用於 13 歲以下的兒童。我們不會故意收集兒童的個人資料。如果我們發現已收集兒童的資料，將會盡速刪除。
          </p>

          <h2>10. 政策變更</h2>
          <p>
            我們可能會不時更新本隱私政策。重大變更時，我們會在服務中通知您。建議您定期查閱本政策以了解最新內容。
          </p>

          <h2>11. 聯絡我們</h2>
          <p>
            如果您對本隱私政策有任何疑問或需要行使您的權利，請透過以下方式與我們聯繫：
          </p>
          <ul>
            <li>電子郵件：support@postlyzer.com</li>
          </ul>

          <hr />

          <p className="text-sm text-muted-foreground">
            本隱私政策以中華民國法律為準據法。
          </p>
        </article>
      </div>
    </main>
  );
}
