import { loadDotenv } from "../dotenv.js";
import { loadEnv } from "../env.js";
import { prisma } from "../prisma.js";

async function run() {
  loadDotenv();
  loadEnv();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      ingestTokenPreview: true,
      createdAt: true,
      updatedAt: true
    }
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, users }, null, 2));
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
