import type { NextAuthOptions } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./lib/prisma";
import { migrateLegacyDataToUser, seedDefaultCategoryRules } from "./lib/user-provisioning";

const resolvedSecret =
  process.env.NEXTAUTH_SECRET ??
  process.env.AUTH_SECRET ??
  // Fallback keeps the app from crashing if secret is missing; replace in prod.
  "development-only-secret";

const adapter: Adapter = PrismaAdapter(prisma);

export const authOptions: NextAuthOptions = {
  adapter,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      // Allow automatic account linking when a GitHub email matches an existing user.
      // This is safe for our single-provider (GitHub-only) setup, but would require
      // additional safeguards if multiple OAuth providers are added in the future.
      allowDangerousEmailAccountLinking: true
    })
  ],
  secret: resolvedSecret,
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    }
  },
  events: {
    async signIn({ user }) {
      if (!user?.id) return;
      await migrateLegacyDataToUser(user.id);
      await seedDefaultCategoryRules(user.id);
    }
  }
};
