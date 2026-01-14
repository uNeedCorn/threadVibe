import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service - Postlyzer",
  description: "Terms and conditions for using Postlyzer",
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
          Back to Home
        </Link>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Terms of Service</h1>
          <p className="lead">
            Last updated: January 2026
          </p>

          <p>
            Welcome to Postlyzer (the &quot;Service&quot;). Please read these terms carefully before using the Service. By using the Service, you agree to be bound by these terms.
          </p>

          <h2>1. Service Description</h2>
          <p>
            Postlyzer is a Threads post analytics platform that provides:
          </p>
          <ul>
            <li>Automatic synchronization of your Threads post data</li>
            <li>Tracking of post performance metrics (views, engagement, etc.)</li>
            <li>Data visualization and analytics reports</li>
            <li>Management of multiple Threads accounts</li>
          </ul>

          <h2>2. Account Registration and Use</h2>
          <h3>2.1 Account Creation</h3>
          <p>
            You must sign in with a Google account and authorize your Threads account to use the Service. You must provide accurate and complete information and keep your account information up to date.
          </p>

          <h3>2.2 Account Security</h3>
          <p>
            You are responsible for maintaining the security of your account, including protecting your login credentials. You are responsible for all activities conducted through your account, whether or not authorized by you.
          </p>

          <h3>2.3 Account Restrictions</h3>
          <p>You may not:</p>
          <ul>
            <li>Create multiple accounts to circumvent service limitations</li>
            <li>Share your account with others</li>
            <li>Sell or transfer your account</li>
          </ul>

          <h2>3. Acceptable Use</h2>
          <p>When using the Service, you agree to:</p>
          <ul>
            <li>Comply with all applicable laws and regulations</li>
            <li>Comply with Meta/Threads terms of service and usage policies</li>
            <li>Not engage in any behavior that may harm the Service or other users</li>
            <li>Not attempt to access unauthorized systems or data</li>
            <li>Not use automated tools or scripts to interfere with the Service</li>
          </ul>

          <h2>4. Intellectual Property</h2>
          <h3>4.1 Service Content</h3>
          <p>
            The Service and its original content, features, and design are the property of Postlyzer and are protected by copyright, trademark, and other intellectual property laws.
          </p>

          <h3>4.2 User Content</h3>
          <p>
            Content you create on Threads remains yours. You grant the Service permission to access, process, and display this content to provide the Service functionality.
          </p>

          <h2>5. Third-Party Services</h2>
          <p>
            The Service relies on the Meta/Threads API. We have no control over Threads service availability, API changes, or policy adjustments. We are not responsible for any impact to the Service caused by changes on the Threads side.
          </p>

          <h2>6. Service Modifications and Interruptions</h2>
          <p>
            We reserve the right to modify, suspend, or terminate the Service (or any part thereof) at any time, with or without notice. We are not liable for any modifications, suspension, or termination of the Service.
          </p>

          <h2>7. Disclaimer</h2>
          <p>
            The Service is provided &quot;as is&quot; and &quot;as available&quot; without any express or implied warranties, including but not limited to:
          </p>
          <ul>
            <li>That the Service will be uninterrupted or error-free</li>
            <li>The accuracy or completeness of data</li>
            <li>Fitness for a particular purpose</li>
          </ul>

          <h2>8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Postlyzer and its administrators, employees, and partners shall not be liable for:
          </p>
          <ul>
            <li>Any loss arising from use or inability to use the Service</li>
            <li>Loss or corruption of data</li>
            <li>Actions or content of third-party services</li>
            <li>Any indirect, incidental, special, or punitive damages</li>
          </ul>

          <h2>9. Indemnification</h2>
          <p>
            You agree to indemnify and hold Postlyzer harmless from any claims, losses, liabilities, and expenses (including attorney&apos;s fees) arising from your violation of these terms or use of the Service.
          </p>

          <h2>10. Account Termination</h2>
          <p>
            You may delete your account at any time. We also reserve the right to suspend or terminate your account in the following circumstances:
          </p>
          <ul>
            <li>Violation of these Terms of Service</li>
            <li>Fraudulent or illegal activity</li>
            <li>Prolonged account inactivity</li>
          </ul>

          <h2>11. Changes to These Terms</h2>
          <p>
            We may update these Terms of Service from time to time. For significant changes, we will notify you through the Service. Continued use of the Service constitutes acceptance of the updated terms.
          </p>

          <h2>12. Governing Law and Jurisdiction</h2>
          <p>
            These terms are governed by the laws of the Republic of China (Taiwan). Any disputes arising from these terms or the Service shall be subject to the exclusive jurisdiction of the Taipei District Court, Taiwan.
          </p>

          <h2>13. General Provisions</h2>
          <ul>
            <li><strong>Entire Agreement:</strong> These terms constitute the entire agreement between you and Postlyzer regarding use of the Service</li>
            <li><strong>Severability:</strong> If any part of these terms is found to be invalid or unenforceable, the remaining provisions remain in effect</li>
            <li><strong>Waiver:</strong> Failure to enforce any right under these terms does not constitute a waiver of that right</li>
          </ul>

          <h2>14. Contact Us</h2>
          <p>
            If you have any questions about these Terms of Service, please contact us at:
          </p>
          <ul>
            <li>Email: support@postlyzer.com</li>
          </ul>

          <hr />

          <p className="text-sm text-muted-foreground">
            By using the Service, you acknowledge that you have read, understood, and agree to these Terms of Service.
          </p>
        </article>
      </div>
    </main>
  );
}
