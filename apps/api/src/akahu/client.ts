type AkahuAccount = {
  _id: string;
  name?: string;
  status?: string;
  type?: string;
  currency?: string;
  institution?: { name?: string };
};

type AkahuTransactionPayload = {
  _id: string;
  _account?: string;
  amount?: number;
  balance?: number | null;
  description?: string;
  merchant?: { name?: string };
  merchant_name?: string;
  settled_at?: string;
  date?: string;
};

export type AkahuTransaction = {
  id: string;
  date: string;
  accountId: string;
  accountName: string;
  amount: number;
  balance: number | null;
  descriptionRaw: string;
  merchantName: string;
  source: string;
};

export type AkahuAccountSnapshot = {
  id: string;
  name: string;
  institution?: string | null;
  type?: string | null;
  status?: string | null;
  currency?: string | null;
};

type AkahuClientOptions = {
  userToken: string;
  appToken: string;
  baseUrl?: string;
  pageSize?: number;
  fetchFn?: typeof fetch;
};

export class AkahuClient {
  private readonly userToken: string;
  private readonly appToken: string;
  private readonly baseUrl: string;
  private readonly pageSize: number;
  private readonly fetchFn: typeof fetch;
  private accountMap: Map<string, AkahuAccountSnapshot> | null = null;

  constructor(options: AkahuClientOptions) {
    this.userToken = options.userToken;
    this.appToken = options.appToken;
    this.baseUrl = (options.baseUrl ?? "https://api.akahu.io/v1").replace(/\/$/, "");
    this.pageSize = options.pageSize ?? 250;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async fetchAccounts(): Promise<AkahuAccountSnapshot[]> {
    if (this.accountMap) return Array.from(this.accountMap.values());
    const payload = await this.request<{ items?: AkahuAccount[] }>("/accounts");
    const accounts = (payload.items ?? []).map((account) => ({
      id: account._id,
      name: account.name ?? "unknown",
      institution: account.institution?.name ?? null,
      type: account.type ?? null,
      status: account.status ?? null,
      currency: account.currency ?? null
    }));
    this.accountMap = new Map(accounts.map((account) => [account.id, account]));
    return accounts;
  }

  async fetchSettledTransactions(params: { start: Date; end: Date }): Promise<AkahuTransaction[]> {
    const accountMap = await this.fetchAccounts();
    const accountLookup = new Map(accountMap.map((account) => [account.id, account.name]));
    const results: AkahuTransaction[] = [];
    let cursor: string | null = null;

    while (true) {
      const payload: { items?: AkahuTransactionPayload[]; cursor?: { next?: string | null } } = await this.request(
        "/transactions",
        {
          start: params.start.toISOString(),
          end: params.end.toISOString(),
          limit: String(this.pageSize),
          type: "SETTLED",
          ...(cursor ? { cursor } : {})
        }
      );

      const items = payload.items ?? [];
      for (const item of items) {
        const accountId = item._account ?? "unknown";
        results.push({
          id: item._id,
          date: ensureIsoDate(item.date ?? item.settled_at),
          accountId,
          accountName: accountLookup.get(accountId) ?? "unknown",
          amount: safeNumber(item.amount),
          balance: safeNullableNumber(item.balance),
          descriptionRaw: item.description ?? "",
          merchantName: item.merchant?.name?.trim() || item.merchant_name || "",
          source: "akahu"
        });
      }

      cursor = payload.cursor?.next ?? null;
      if (!cursor) break;
    }

    return results;
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value != null && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }

    const response = await this.fetchFn(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.userToken}`,
        "X-Akahu-Id": this.appToken
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Akahu request failed (${response.status}): ${body}`);
    }

    return (await response.json()) as T;
  }
}

function safeNumber(value: number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

function safeNullableNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function ensureIsoDate(raw?: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (raw.length >= 10) return raw.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}
