import { Card, PageHeader } from "../components/ui";
import CategoriesForm from "./categories-form";
import { demoCategories } from "../demo-data";
import { getSessionOrNull } from "../lib/session";
import { fetchUserApi } from "../lib/api-client";

type CategoryRule = {
  id?: string;
  pattern: string;
  field: string;
  category: string;
  categoryType: string;
  priority: number;
  amountCondition?: string | null;
  isDisabled?: boolean;
};

type CategoriesResponse = {
  rules: CategoryRule[];
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const session = await getSessionOrNull();
  const isDemo = !session;

  let data: CategoriesResponse;
  if (isDemo) {
    data = demoCategories as CategoriesResponse;
  } else {
    const res = await fetchUserApi<CategoriesResponse>(session, "/api/categories");
    if (!res.ok || !res.data) {
      return (
        <div className="section">
          <PageHeader title="Categories" description="Rules that map merchant text to categories." />
          <Card title="API unavailable">
            <p className="muted">Failed to load from API: {res.status}</p>
          </Card>
        </div>
      );
    }
    data = res.data;
  }

  return (
    <div className="section">
      <PageHeader title="Categories" description="Rules that map merchant text to categories." />
      <Card title="Mapping rules" subtitle="Priority order matters; first match wins.">
        <CategoriesForm initialRules={data.rules} isDemo={isDemo} />
      </Card>
    </div>
  );
}
