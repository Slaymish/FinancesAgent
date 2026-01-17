"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function AuthButton() {
  const { data } = useSession();
  const isAuthed = !!data;

  return (
    <button className="button" onClick={() => (isAuthed ? signOut() : signIn("github"))}>
      {isAuthed ? "Sign out" : "Sign in with GitHub"}
    </button>
  );
}
