import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy - Postlyzer",
  description: "Learn how Postlyzer collects, uses, and protects your personal data",
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
          Back to Home
        </Link>

        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <h1>Privacy Policy</h1>
          <p className="lead">
            Last updated: January 2026
          </p>

          <p>
            Welcome to Postlyzer (the &quot;Service&quot;). We value your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, store, and protect your information.
          </p>

          <h2>1. Information We Collect</h2>
          <p>When you use our Service, we may collect the following types of data:</p>

          <h3>1.1 Information You Provide</h3>
          <ul>
            <li>Basic profile information via Google OAuth (name, email address)</li>
            <li>Account information via Threads OAuth authorization</li>
          </ul>

          <h3>1.2 Information Collected Automatically</h3>
          <ul>
            <li>Your Threads posts and performance metrics (views, engagement, etc.)</li>
            <li>Service usage logs and activity records</li>
            <li>Device information and browser type</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use the collected data for the following purposes:</p>
          <ul>
            <li>To provide, maintain, and improve the Service</li>
            <li>To analyze your Threads post performance</li>
            <li>To generate reports and insights</li>
            <li>To communicate with you about the Service</li>
            <li>To detect and prevent fraud or abuse</li>
          </ul>

          <h2>3. Information Sharing</h2>
          <p>We do not sell your personal data. We may share your information in the following circumstances:</p>
          <ul>
            <li><strong>Service Providers:</strong> With third parties that help us operate the Service (e.g., cloud infrastructure providers)</li>
            <li><strong>Legal Requirements:</strong> When required by law or government authorities</li>
            <li><strong>Business Transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
          </ul>

          <h2>4. Third-Party Services</h2>
          <p>Our Service integrates with the following third-party services:</p>
          <ul>
            <li><strong>Google:</strong> For account authentication (OAuth 2.0)</li>
            <li><strong>Meta / Threads:</strong> For accessing your Threads account data</li>
          </ul>
          <p>These services have their own privacy policies, which we recommend you review separately.</p>

          <h2>5. Data Security</h2>
          <p>We implement appropriate technical and organizational measures to protect your data, including:</p>
          <ul>
            <li>HTTPS encryption for data transmission</li>
            <li>Access control management</li>
            <li>Regular security reviews</li>
          </ul>
          <p>However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p>

          <h2>6. Data Retention</h2>
          <p>
            We retain your data for as long as necessary to provide the Service. When you delete your account, we will delete or anonymize your personal data within a reasonable period, though we may retain some data as required by law.
          </p>

          <h2>7. Your Rights</h2>
          <p>Depending on applicable laws, you may have the following rights:</p>
          <ul>
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Delete your data</li>
            <li>Withdraw consent</li>
            <li>Data portability</li>
          </ul>
          <p>To exercise these rights, please contact us using the information below.</p>

          <h2>8. Cookies</h2>
          <p>
            We use cookies and similar technologies to maintain your login session and improve your experience. You can manage cookie preferences through your browser settings, but this may affect some functionality.
          </p>

          <h2>9. Children&apos;s Privacy</h2>
          <p>
            Our Service is not intended for children under 13. We do not knowingly collect personal data from children. If we discover that we have collected data from a child, we will promptly delete it.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. For significant changes, we will notify you through the Service. We recommend reviewing this policy periodically.
          </p>

          <h2>11. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at:
          </p>
          <ul>
            <li>Email: support@postlyzer.com</li>
          </ul>

          <hr />

          <p className="text-sm text-muted-foreground">
            This Privacy Policy is governed by the laws of the Republic of China (Taiwan).
          </p>
        </article>
      </div>
    </main>
  );
}
