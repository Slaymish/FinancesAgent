import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:3001";
    const internalApiKey = process.env.INTERNAL_API_KEY || "dev-internal-key";

    const res = await fetch(`${apiBaseUrl}/api/inbox/${params.id}/confirm`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-INTERNAL-API-KEY": internalApiKey,
        "X-USER-ID": session.user.id
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Inbox confirm error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
