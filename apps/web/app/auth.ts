import type { NextAuthOptions } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "./lib/prisma";
import { generateIngestToken, hashToken } from "./lib/tokens";
import { ensureUserHasIngestToken, migrateLegacyDataToUser } from "./lib/user-provisioning";

const resolvedSecret =
  process.env.NEXTAUTH_SECRET ??
  process.env.AUTH_SECRET ??
  // Fallback keeps the app from crashing if secret is missing; replace in prod.
  "development-only-secret";

const baseAdapter = PrismaAdapter(prisma);
const adapter: Adapter = {
  ...baseAdapter,
  async createUser(data: AdapterUser) {
    const token = generateIngestToken();
    const hash = hashToken(token);
    const preview = token.slice(-6);
    const user = await prisma.user.create({
      data: {
        ...data,
        ingestTokenHash: hash,
        ingestTokenPreview: preview
      }
    });
    return user;
  }
};

export const authOptions: NextAuthOptions = {
  adapter,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? ""
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
      await ensureUserHasIngestToken(user.id);
    }
  }
};
