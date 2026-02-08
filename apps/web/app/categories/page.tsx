import { Card, PageHeader } from "../components/ui";
import { getSessionOrNull } from "../lib/session";
import { fetchUserApi } from "../lib/api-client";
import { CategoriesDrilldown } from "./transactions-drilldown";

type CategorySummary = {
  category: string;
  count: number;
  expenseTotal: number;
  incomeTotal: number;
  lastDate: string | null;
};

type CategoryTransaction = {
  id: string;
  date: string;
  merchantName: string;
  descriptionRaw: string;
  amount: number;
  accountName: string;
  category: string;
};

type CategoriesResponse = {
  ok: boolean;
  categories: CategorySummary[];
  selectedCategory: string | null;
  transactions: CategoryTransaction[];
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams
}: {
  searchParams?: { category?: string | string[] };
}) {
  const session = await getSessionOrNull();

  if (!session?.user?.id) {
    return (
      <div className="section">
        <PageHeader title="Categories" description="Review your categories and adjust transactions." />
        <Card title="Sign in required">
          <p className="muted">Please sign in to manage categories.</p>
        </Card>
      </div>
    );
  }

  const categoryParam =
    typeof searchParams?.category === "string"
      ? searchParams.category
      : Array.isArray(searchParams?.category)
        ? searchParams?.category[0]
        : undefined;

  const path = categoryParam
    ? `/api/transactions/categories?category=${encodeURIComponent(categoryParam)}`
    : "/api/transactions/categories";

  const res = await fetchUserApi<CategoriesResponse>(session, path);
  if (!res.ok || !res.data) {
    return (
      <div className="section">
        <PageHeader title="Categories" description="Review your categories and adjust transactions." />
        <Card title="API unavailable">
          <p className="muted">Failed to load categories: {res.status}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="section">
      <PageHeader
        title="Categories"
        description="Drill into each category and correct classifications."
        meta={[
          { label: "Categories", value: String(res.data.categories.length) },
          { label: "Selected", value: res.data.selectedCategory ?? "None" }
        ]}
      />
      <CategoriesDrilldown
        categories={res.data.categories}
        selectedCategory={res.data.selectedCategory}
        transactions={res.data.transactions}
      />
    </div>
  );
}
