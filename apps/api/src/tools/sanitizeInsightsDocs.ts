import { loadDotenv } from "../dotenv.js";
import { loadEnv } from "../env.js";
import { prisma } from "../prisma.js";
import { sanitizeInsightsMarkdown } from "../insights/sanitize.js";

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) continue;
    if (token === "--dry-run") {
      args.set("dry-run", true);
      continue;
    }
    if (token === "--user" || token === "--user-id") {
      const value = argv[i + 1];
      if (!value) throw new Error(`${token} requires a value`);
      args.set("userId", value);
      i += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      args.set("help", true);
      continue;
    }
    throw new Error(`Unknown arg: ${token}`);
  }
  return args;
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(
    [
      "Sanitize existing insights docs to demo-style bullet-only markdown.",
      "",
      "Usage:",
      "  pnpm --filter @health-agent/api insights:sanitize [--dry-run] [--user <userId>]",
      "",
      "Options:",
      "  --dry-run        Print counts but do not write changes",
      "  --user <userId>  Only sanitize docs for a single user",
      "  -h, --help       Show help"
    ].join("\n")
  );
}

async function run() {
  loadDotenv();
  loadEnv();

  const args = parseArgs(process.argv.slice(2));
  if (args.get("help")) {
    printHelp();
    return;
  }

  const dryRun = Boolean(args.get("dry-run"));
  const userId = typeof args.get("userId") === "string" ? (args.get("userId") as string) : null;

  let scanned = 0;
  let changed = 0;

  const pageSize = 200;
  let cursorId: string | null = null;

  for (;;) {
    const docs: Awaited<ReturnType<typeof prisma.insightsDoc.findMany>> = await prisma.insightsDoc.findMany({
      where: {
        ...(userId ? { userId } : {})
      },
      orderBy: { id: "asc" },
      take: pageSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {})
    });

    if (docs.length === 0) break;

    for (const doc of docs) {
      scanned += 1;
      const sanitized = sanitizeInsightsMarkdown(doc.markdown);
      if (!sanitized.changed) continue;
      changed += 1;

      if (!dryRun) {
        await prisma.insightsDoc.update({
          where: { id: doc.id },
          data: {
            markdown: sanitized.markdown,
            diffFromPrev: null
          }
        });
      }
    }

    cursorId = docs[docs.length - 1]!.id;
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        userId,
        scanned,
        changed
      },
      null,
      2
    )
  );
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
