import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth";
import { prisma } from "../../lib/prisma";
import { generateIngestToken, hashToken } from "../../lib/tokens";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { ingestTokenPreview: true }
  });

  return NextResponse.json({ preview: user?.ingestTokenPreview ?? null });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = generateIngestToken();
  const preview = token.slice(-6);
  const hashed = hashToken(token);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ingestTokenHash: hashed,
      ingestTokenPreview: preview
    }
  });

  return NextResponse.json({ token, preview });
}
