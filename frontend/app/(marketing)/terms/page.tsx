import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "服務條款 - Postlyzer",
  description: "Postlyzer 服務使用條款與規範",
};

export default function TermsPage() {
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
          <h1>服務條款</h1>
          <p className="lead">
            最後更新日期：2025 年 1 月
          </p>

          <p>
            歡迎使用 Postlyzer（以下簡稱「本服務」）。在使用本服務前，請仔細閱讀以下條款。使用本服務即表示您同意受本條款約束。
          </p>

          <h2>1. 服務說明</h2>
          <p>
            Postlyzer 是一個 Threads 貼文成效分析平台，提供以下功能：
          </p>
          <ul>
            <li>自動同步您的 Threads 貼文數據</li>
            <li>追蹤貼文成效指標（觀看數、互動數等）</li>
            <li>提供數據視覺化與分析報表</li>
            <li>管理多個 Threads 帳號</li>
          </ul>

          <h2>2. 帳號註冊與使用</h2>
          <h3>2.1 帳號建立</h3>
          <p>
            您需要透過 Google 帳號登入並授權連結您的 Threads 帳號才能使用本服務。您必須提供準確、完整的資訊，並維護帳號資訊的更新。
          </p>

          <h3>2.2 帳號安全</h3>
          <p>
            您有責任維護帳號的安全性，包括保護您的登入憑證。任何透過您帳號進行的活動，無論是否經您授權，均由您負責。
          </p>

          <h3>2.3 帳號限制</h3>
          <p>您不得：</p>
          <ul>
            <li>建立多個帳號以規避服務限制</li>
            <li>與他人共享帳號</li>
            <li>出售或轉讓您的帳號</li>
          </ul>

          <h2>3. 使用規範</h2>
          <p>使用本服務時，您同意：</p>
          <ul>
            <li>遵守所有適用法律和法規</li>
            <li>遵守 Meta/Threads 的服務條款和使用政策</li>
            <li>不從事任何可能損害本服務或其他用戶的行為</li>
            <li>不嘗試存取未經授權的系統或資料</li>
            <li>不使用自動化工具或腳本干擾服務運作</li>
          </ul>

          <h2>4. 智慧財產權</h2>
          <h3>4.1 服務內容</h3>
          <p>
            本服務及其原創內容、功能和設計均為 Postlyzer 的財產，受著作權、商標權等智慧財產權法律保護。
          </p>

          <h3>4.2 用戶內容</h3>
          <p>
            您透過 Threads 產生的內容仍歸您所有。您授權本服務存取、處理和顯示這些內容，以提供服務功能。
          </p>

          <h2>5. 第三方服務</h2>
          <p>
            本服務依賴 Meta/Threads API 運作。我們無法控制 Threads 的服務可用性、API 變更或政策調整。如因 Threads 端的變更導致服務受影響，我們不承擔相關責任。
          </p>

          <h2>6. 服務變更與中斷</h2>
          <p>
            我們保留隨時修改、暫停或終止服務（或其任何部分）的權利，無論是否事先通知。我們不對服務的任何修改、暫停或終止承擔責任。
          </p>

          <h2>7. 免責聲明</h2>
          <p>
            本服務按「現狀」和「可用性」提供，不提供任何明示或暗示的保證，包括但不限於：
          </p>
          <ul>
            <li>服務不會中斷或無錯誤</li>
            <li>資料的準確性或完整性</li>
            <li>服務適合特定用途</li>
          </ul>

          <h2>8. 責任限制</h2>
          <p>
            在法律允許的最大範圍內，Postlyzer 及其管理者、員工、合作夥伴不對以下情況承擔責任：
          </p>
          <ul>
            <li>使用或無法使用本服務造成的任何損失</li>
            <li>資料遺失或損壞</li>
            <li>第三方服務的行為或內容</li>
            <li>任何間接、附帶、特殊或懲罰性損害</li>
          </ul>

          <h2>9. 賠償</h2>
          <p>
            您同意就因您違反本條款或使用本服務而產生的任何索賠、損失、責任、費用（包括律師費），賠償並使 Postlyzer 免受損害。
          </p>

          <h2>10. 帳號終止</h2>
          <p>
            您可以隨時刪除您的帳號。我們也保留在以下情況下暫停或終止您帳號的權利：
          </p>
          <ul>
            <li>違反本服務條款</li>
            <li>從事詐欺或非法活動</li>
            <li>長期未使用帳號</li>
          </ul>

          <h2>11. 條款變更</h2>
          <p>
            我們可能會不時更新本服務條款。重大變更時，我們會在服務中通知您。繼續使用本服務即表示您接受更新後的條款。
          </p>

          <h2>12. 準據法與管轄</h2>
          <p>
            本條款以中華民國法律為準據法。任何因本條款或本服務產生的爭議，雙方同意以台灣台北地方法院為第一審管轄法院。
          </p>

          <h2>13. 一般條款</h2>
          <ul>
            <li><strong>完整協議：</strong>本條款構成您與 Postlyzer 之間關於服務使用的完整協議</li>
            <li><strong>可分割性：</strong>如本條款任何部分被認定無效或無法執行，其餘部分仍然有效</li>
            <li><strong>棄權：</strong>未能執行本條款的任何權利不構成對該權利的放棄</li>
          </ul>

          <h2>14. 聯絡我們</h2>
          <p>
            如果您對本服務條款有任何疑問，請透過以下方式與我們聯繫：
          </p>
          <ul>
            <li>電子郵件：support@postlyzer.com</li>
          </ul>

          <hr />

          <p className="text-sm text-muted-foreground">
            使用本服務即表示您已閱讀、理解並同意本服務條款。
          </p>
        </article>
      </div>
    </main>
  );
}
