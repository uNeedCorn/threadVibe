import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy - Postlyzer",
  description: "Learn how Postlyzer collects, uses, and protects your personal data",
};

const sections = [
  { id: "collect", title: "Information We Collect" },
  { id: "use", title: "How We Use Your Information" },
  { id: "sharing", title: "Information Sharing" },
  { id: "third-party", title: "Third-Party Services" },
  { id: "security", title: "Data Security" },
  { id: "retention", title: "Data Retention" },
  { id: "deletion", title: "Data Deletion" },
  { id: "rights", title: "Your Rights" },
  { id: "cookies", title: "Cookies" },
  { id: "children", title: "Children's Privacy" },
  { id: "changes", title: "Changes to This Policy" },
  { id: "contact", title: "Contact Us" },
];

export default function PrivacyPage() {
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
            Privacy Policy
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
              Welcome to Postlyzer. We value your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, store, and protect your information when you use our Threads analytics service.
            </p>

            {/* Section 1 */}
            <section id="collect" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                1. Information We Collect
              </h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-foreground mb-2">Information You Provide</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Basic profile information via Google OAuth (name, email address)</li>
                    <li>Account authorization via Threads OAuth</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Information from Threads API</h3>
                  <p className="text-muted-foreground mb-2">
                    When you connect your Threads account, we collect the following data through the Threads API:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Threads user ID and profile information (username, display name, profile picture URL, biography)</li>
                    <li>Follower and following counts</li>
                    <li>Your published posts (text content, media URLs, post type, publish time)</li>
                    <li>Post engagement metrics (views, likes, replies, reposts, quotes)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-2">Information Collected Automatically</h3>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Service usage logs and activity records</li>
                    <li>Device information and browser type</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section id="use" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                2. How We Use Your Information
              </h2>
              <p className="text-muted-foreground mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Provide, maintain, and improve the Service</li>
                <li>Synchronize and display your Threads posts</li>
                <li>Calculate and track post performance metrics over time</li>
                <li>Generate analytics reports and insights</li>
                <li>Communicate with you about the Service</li>
                <li>Detect and prevent fraud or abuse</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="sharing" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                3. Information Sharing
              </h2>
              <p className="text-muted-foreground mb-4">
                We do not sell your personal data. We may share your information in the following circumstances:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Service Providers:</strong>{" "}
                  With third parties that help us operate the Service (e.g., cloud infrastructure providers such as Supabase)
                </li>
                <li>
                  <strong className="text-foreground">Legal Requirements:</strong>{" "}
                  When required by law or government authorities
                </li>
                <li>
                  <strong className="text-foreground">Business Transfers:</strong>{" "}
                  In connection with mergers, acquisitions, or asset sales
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="third-party" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                4. Third-Party Services
              </h2>
              <p className="text-muted-foreground mb-4">
                Our Service integrates with the following third-party services:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Google:</strong>{" "}
                  For account authentication (OAuth 2.0). See{" "}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Google Privacy Policy
                  </a>
                </li>
                <li>
                  <strong className="text-foreground">Meta / Threads:</strong>{" "}
                  For accessing your Threads account data via the Threads API. See{" "}
                  <a href="https://privacycenter.instagram.com/policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Meta Privacy Policy
                  </a>
                </li>
                <li>
                  <strong className="text-foreground">Supabase:</strong>{" "}
                  For data storage and authentication services. See{" "}
                  <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Supabase Privacy Policy
                  </a>
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="security" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                5. Data Security
              </h2>
              <p className="text-muted-foreground mb-4">
                We implement appropriate technical and organizational measures to protect your data:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>HTTPS/TLS encryption for all data transmission</li>
                <li>Encrypted storage for sensitive data (e.g., access tokens)</li>
                <li>Row-level security policies for data access control</li>
                <li>Regular security reviews and updates</li>
              </ul>
              <p className="text-muted-foreground mt-4 text-sm">
                However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.
              </p>
            </section>

            {/* Section 6 */}
            <section id="retention" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                6. Data Retention
              </h2>
              <p className="text-muted-foreground mb-4">
                We retain your data according to the following schedule:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Account Data:</strong>{" "}
                  Retained while your account is active
                </li>
                <li>
                  <strong className="text-foreground">Threads Data:</strong>{" "}
                  Retained while your Threads account is connected. Deleted when you unlink your account or delete your account
                </li>
                <li>
                  <strong className="text-foreground">Performance Metrics:</strong>{" "}
                  Historical metrics are retained for the duration of your account to provide trend analysis
                </li>
                <li>
                  <strong className="text-foreground">After Deletion:</strong>{" "}
                  All personal data is deleted within 30 days of account deletion. Backup data is purged within 30 days
                </li>
              </ul>
            </section>

            {/* Section 7 - NEW */}
            <section id="deletion" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                7. Data Deletion
              </h2>
              <p className="text-muted-foreground mb-4">
                You can delete your data at any time through the following methods:
              </p>
              <ul className="space-y-3 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Unlink Threads Account:</strong>{" "}
                  Remove a specific Threads account and all associated data from Settings
                </li>
                <li>
                  <strong className="text-foreground">Delete Workspace:</strong>{" "}
                  Delete an entire workspace and all connected accounts from Settings
                </li>
                <li>
                  <strong className="text-foreground">Delete Account:</strong>{" "}
                  Delete your entire Postlyzer account and all data from Settings &gt; Danger Zone
                </li>
                <li>
                  <strong className="text-foreground">Contact Support:</strong>{" "}
                  Email us at{" "}
                  <a href="mailto:support@metricdesk.io" className="text-primary hover:underline">
                    support@metricdesk.io
                  </a>{" "}
                  if you need assistance
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">
                You may also revoke access through your{" "}
                <a href="https://www.threads.net/settings/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Threads privacy settings
                </a>
                . When you revoke access, we will receive a notification from Meta and will delete your data accordingly.
              </p>
              <p className="text-muted-foreground mt-4">
                For more details, please visit our{" "}
                <Link href="/data-deletion" className="text-primary hover:underline">
                  Data Deletion page
                </Link>.
              </p>
            </section>

            {/* Section 8 */}
            <section id="rights" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                8. Your Rights
              </h2>
              <p className="text-muted-foreground mb-4">
                Depending on applicable laws, you may have the following rights:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Delete your data</li>
                <li>Withdraw consent at any time</li>
                <li>Data portability</li>
                <li>Object to data processing</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                To exercise these rights, please contact us using the information below or manage your data through the Settings page.
              </p>
            </section>

            {/* Section 9 */}
            <section id="cookies" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                9. Cookies
              </h2>
              <p className="text-muted-foreground mb-4">
                We use cookies and similar technologies for the following purposes:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Maintaining your login session</li>
                <li>Remembering your preferences</li>
                <li>Analytics to improve our Service (Microsoft Clarity)</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                You can manage cookie preferences through your browser settings, but this may affect some functionality.
              </p>
            </section>

            {/* Section 10 */}
            <section id="children" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                10. Children&apos;s Privacy
              </h2>
              <p className="text-muted-foreground">
                Our Service is not intended for children under 13. We do not knowingly collect personal data from children. If we discover that we have collected data from a child, we will promptly delete it.
              </p>
            </section>

            {/* Section 11 */}
            <section id="changes" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                11. Changes to This Policy
              </h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. For significant changes, we will notify you through the Service or via email. We recommend reviewing this policy periodically. Your continued use of the Service after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            {/* Section 12 */}
            <section id="contact" className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b">
                12. Contact Us
              </h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at:
              </p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="text-foreground">
                  <strong>Email:</strong>{" "}
                  <a href="mailto:support@metricdesk.io" className="text-primary hover:underline">
                    support@metricdesk.io
                  </a>
                </p>
                <p className="text-muted-foreground text-sm">
                  We will respond to your inquiry within 7 business days.
                </p>
              </div>
            </section>

            {/* Footer */}
            <footer className="pt-8 border-t">
              <p className="text-sm text-muted-foreground">
                This Privacy Policy is governed by the laws of the Republic of China (Taiwan).
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
