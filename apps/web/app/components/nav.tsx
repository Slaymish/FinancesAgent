"use client";

import Link from "next/link";
import { CalendarClock, Database, LayoutDashboard, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SyncButton from "./sync-button";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/planning", label: "Planning", icon: CalendarClock },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/data", label: "Data", icon: Database }
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
