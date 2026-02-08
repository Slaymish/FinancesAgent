"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";

function formatName(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0];
}

export default function UserGreeting() {
  const { data } = useSession();
  const name = data?.user?.name ?? data?.user?.email ?? "";

  if (!data) {
    return (
      <button className="button" onClick={() => signIn("github")}>
        Sign in with GitHub
      </button>
    );
  }

  return (
    <details className="user-menu">
      <summary className="greeting user-menu__toggle">
        Hi {formatName(name)}!
        <ChevronDown className="user-menu__chevron" aria-hidden="true" />
      </summary>
      <div className="user-menu__panel" role="menu" aria-label="Account">
        <Link className="user-menu__item" href="/month" role="menuitem">
          Month
        </Link>
        <button className="user-menu__item" type="button" onClick={() => signOut()} role="menuitem">
          Sign out
        </button>
      </div>
    </details>
  );
}
