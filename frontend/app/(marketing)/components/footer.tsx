import Link from "next/link";
import Image from "next/image";

const footerLinks = [
  { label: "服務條款", href: "/terms" },
  { label: "隱私政策", href: "/privacy" },
  { label: "資料刪除", href: "/data-deletion" },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-8 border-t bg-card">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2">
            <Image
              src="/logo-icon.png"
              alt="Postlyzer"
              width={32}
              height={32}
              className="size-8"
            />
            <span className="font-semibold text-foreground">Postlyzer</span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap items-center justify-center gap-6">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} Postlyzer
          </p>
        </div>
      </div>
    </footer>
  );
}
