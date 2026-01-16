import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service - Postlyzer",
  description: "Terms and conditions for using Postlyzer",
};

const sections = [
  { id: "service", title: "Service Description" },
  { id: "account", title: "Account Registration and Use" },
  { id: "acceptable-use", title: "Acceptable Use" },
  { id: "ip", title: "Intellectual Property" },
  { id: "third-party", title: "Third-Party Services" },
  { id: "modifications", title: "Service Modifications" },
  { id: "disclaimer", title: "Disclaimer" },
  { id: "liability", title: "Limitation of Liability" },
  { id: "indemnification", title: "Indemnification" },
  { id: "termination", title: "Account Termination" },
  { id: "changes", title: "Changes to These Terms" },
  { id: "governing-law", title: "Governing Law" },
  { id: "contact", title: "Contact Us" },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </Link>

        {/* Header */}
        <header className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Terms of Service
          </h1>
          <p className="text-muted-foreground">
            Last updated: January 2026
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-12">
          {/* Main Content */}
          <article className="space-y-12">
            {/* Intro */}
            <p className="text-lg text-muted-foreground leading-relaxed">
              Welcome to Postlyzer. Please read these terms carefully before using the Service. By using the Service, you agree to be bound by these terms.
            </p>

            {/* Section 1 */}
            <section id="service" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                1. Service Description
              </h2>
              <p className="text-muted-foreground mb-4">
                Postlyzer is a Threads post analytics platform that provides:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Automatic synchronization of your Threads post data</li>
                <li>Tracking of post performance metrics (views, engagement, etc.)</li>
                <li>Data visualization and analytics reports</li>
                <li>Management of multiple Threads accounts</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section id="account" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                2. Account Registration and Use
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-foreground mb-2">Account Creation</h3>
                  <p className="text-muted-foreground">
                    You must sign in with a Google account and authorize your Threads account to use the Service. You must provide accurate and complete information and keep your account information up to date.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Account Security</h3>
                  <p className="text-muted-foreground">
                    You are responsible for maintaining the security of your account, including protecting your login credentials. You are responsible for all activities conducted through your account, whether or not authorized by you.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Account Restrictions</h3>
                  <p className="text-muted-foreground mb-2">You may not:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Create multiple accounts to circumvent service limitations</li>
                    <li>Share your account with others</li>
                    <li>Sell or transfer your account</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section id="acceptable-use" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                3. Acceptable Use
              </h2>
              <p className="text-muted-foreground mb-4">
                When using the Service, you agree to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Comply with all applicable laws and regulations</li>
                <li>Comply with Meta/Threads terms of service and usage policies</li>
                <li>Not engage in any behavior that may harm the Service or other users</li>
                <li>Not attempt to access unauthorized systems or data</li>
                <li>Not use automated tools or scripts to interfere with the Service</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="ip" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                4. Intellectual Property
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-foreground mb-2">Service Content</h3>
                  <p className="text-muted-foreground">
                    The Service and its original content, features, and design are the property of Postlyzer and are protected by copyright, trademark, and other intellectual property laws.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">User Content</h3>
                  <p className="text-muted-foreground">
                    Content you create on Threads remains yours. You grant the Service permission to access, process, and display this content to provide the Service functionality.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section id="third-party" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                5. Third-Party Services
              </h2>
              <p className="text-muted-foreground">
                The Service relies on the Meta/Threads API. We have no control over Threads service availability, API changes, or policy adjustments. We are not responsible for any impact to the Service caused by changes on the Threads side.
              </p>
            </section>

            {/* Section 6 */}
            <section id="modifications" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                6. Service Modifications and Interruptions
              </h2>
              <p className="text-muted-foreground">
                We reserve the right to modify, suspend, or terminate the Service (or any part thereof) at any time, with or without notice. We are not liable for any modifications, suspension, or termination of the Service.
              </p>
            </section>

            {/* Section 7 */}
            <section id="disclaimer" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                7. Disclaimer
              </h2>
              <p className="text-muted-foreground mb-4">
                The Service is provided &quot;as is&quot; and &quot;as available&quot; without any express or implied warranties, including but not limited to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>That the Service will be uninterrupted or error-free</li>
                <li>The accuracy or completeness of data</li>
                <li>Fitness for a particular purpose</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section id="liability" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                8. Limitation of Liability
              </h2>
              <p className="text-muted-foreground mb-4">
                To the maximum extent permitted by law, Postlyzer and its administrators, employees, and partners shall not be liable for:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Any loss arising from use or inability to use the Service</li>
                <li>Loss or corruption of data</li>
                <li>Actions or content of third-party services</li>
                <li>Any indirect, incidental, special, or punitive damages</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section id="indemnification" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                9. Indemnification
              </h2>
              <p className="text-muted-foreground">
                You agree to indemnify and hold Postlyzer harmless from any claims, losses, liabilities, and expenses (including attorney&apos;s fees) arising from your violation of these terms or use of the Service.
              </p>
            </section>

            {/* Section 10 */}
            <section id="termination" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                10. Account Termination
              </h2>
              <p className="text-muted-foreground mb-4">
                You may delete your account at any time. We also reserve the right to suspend or terminate your account in the following circumstances:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Violation of these Terms of Service</li>
                <li>Fraudulent or illegal activity</li>
                <li>Prolonged account inactivity</li>
              </ul>
            </section>

            {/* Section 11 */}
            <section id="changes" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                11. Changes to These Terms
              </h2>
              <p className="text-muted-foreground">
                We may update these Terms of Service from time to time. For significant changes, we will notify you through the Service. Continued use of the Service constitutes acceptance of the updated terms.
              </p>
            </section>

            {/* Section 12 */}
            <section id="governing-law" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                12. Governing Law and Jurisdiction
              </h2>
              <p className="text-muted-foreground mb-4">
                These terms are governed by the laws of the Republic of China (Taiwan). Any disputes arising from these terms or the Service shall be subject to the exclusive jurisdiction of the Taipei District Court, Taiwan.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
                <p><strong className="text-foreground">Entire Agreement:</strong> These terms constitute the entire agreement between you and Postlyzer regarding use of the Service.</p>
                <p><strong className="text-foreground">Severability:</strong> If any part of these terms is found to be invalid or unenforceable, the remaining provisions remain in effect.</p>
                <p><strong className="text-foreground">Waiver:</strong> Failure to enforce any right under these terms does not constitute a waiver of that right.</p>
              </div>
            </section>

            {/* Section 13 */}
            <section id="contact" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                13. Contact Us
              </h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <p className="text-foreground">
                <a href="mailto:support@metricdesk.io" className="text-primary hover:underline">
                  support@metricdesk.io
                </a>
              </p>
            </section>

            {/* Footer */}
            <footer className="pt-8 border-t">
              <p className="text-sm text-muted-foreground">
                By using the Service, you acknowledge that you have read, understood, and agree to these Terms of Service.
              </p>
            </footer>
          </article>

          {/* Table of Contents - Desktop only */}
          <aside className="hidden lg:block">
            <nav className="sticky top-8">
              <h3 className="text-sm font-semibold text-foreground mb-4">On This Page</h3>
              <ul className="space-y-2 text-sm">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {index + 1}. {section.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </div>
    </main>
  );
}
