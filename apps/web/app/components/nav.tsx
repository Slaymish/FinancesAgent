"use client";

import Link from "next/link";
import { CalendarDays, Inbox } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SyncButton from "./sync-button";

const links = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/month", label: "Month", icon: CalendarDays }
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    links.forEach((link) => router.prefetch(link.href));
  }, [router]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <nav className={`nav${isOpen ? " is-open" : ""}`} aria-label="Primary">
      <button
        className="nav-toggle"
        type="button"
        aria-expanded={isOpen}
        aria-controls="primary-navigation"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="nav-toggle-text">Menu</span>
        <span className="nav-toggle-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      <div id="primary-navigation" className="nav-links" aria-hidden={!isOpen}>
        {links.map((link) => {
          const isActive = pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link key={link.href} className={`nav-link${isActive ? " is-active" : ""}`} href={link.href}>
              <Icon aria-hidden="true" />
              {link.label}
            </Link>
          );
        })}
        <div className="nav-actions">
          <SyncButton />
        </div>
      </div>
    </nav>
  );
}
