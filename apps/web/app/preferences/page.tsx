import Link from "next/link";
import { Card, PageHeader } from "../components/ui";
import ThemeToggle from "../components/theme-toggle";
import { getSessionOrNull } from "../lib/session";
import { prisma } from "../lib/prisma";
import PreferencesForm from "./preferences-form";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const session = await getSessionOrNull();

  const userId = session?.user?.id;
  const needsSignIn = !userId;

  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: {
          targetWeightKg: true,
          targetCalories: true,
          targetProteinG: true,
          targetFatG: true,
          targetCarbsG: true,
          targetSleepHours: true,
          targetTrainingSessions: true,
          targetFibreG: true
        }
      })
    : null;

  return (
    <div className="section">
      <PageHeader
        title="Preferences"
        description="Set targets for projections, MacroFactor goals, and recovery baselines."
      />
      <Card title="Appearance" subtitle="Choose the theme that feels best for you." action={<ThemeToggle />}>
        <p className="muted">Toggle between light and dark modes for the dashboard.</p>
      </Card>
      {needsSignIn ? (
        <Card title="Sign in to edit preferences">
          <p className="muted">Create a GitHub session to set your target weight, calories, and macros.</p>
          <Link className="button" href="/api/auth/signin">
            Sign in with GitHub
          </Link>
        </Card>
      ) : (
        <PreferencesForm initial={user ?? null} />
      )}
    </div>
  );
}
