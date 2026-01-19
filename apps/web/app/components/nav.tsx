"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Status" },
  { href: "/insights", label: "Review" },
  { href: "/trends", label: "Trends" },
  { href: "/data-quality", label: "Data" },
  { href: "/preferences", label: "Preferences" },
  { href: "/connect", label: "Connect" }
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
          const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link key={link.href} className={`nav-link${isActive ? " is-active" : ""}`} href={link.href}>
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
