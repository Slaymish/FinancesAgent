import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../../auth";

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const internalApiKey = process.env.INTERNAL_API_KEY;
    if (!internalApiKey) {
      return NextResponse.json({ error: "server_misconfigured" }, { status: 500 });
    }

    const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
    const body = await request.json();

    const res = await fetch(`${apiBaseUrl}/api/transactions/${params.id}/category`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-INTERNAL-API-KEY": internalApiKey,
        "X-USER-ID": session.user.id
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("Transaction category update failed:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
