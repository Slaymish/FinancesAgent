import type { FastifyInstance } from "fastify";
import { prisma } from "../prisma.js";
import { requireUserFromInternalRequest } from "../auth.js";
import { loadEnv } from "../env.js";
import { sanitizeInsightsMarkdown } from "../insights/sanitize.js";
import { generateInsightsUnifiedDiff } from "../insights/llm.js";
import { applyUnifiedDiff } from "../insights/patch.js";

export async function insightsRoutes(app: FastifyInstance) {
    const env = loadEnv();

    app.get("/latest", async (req, reply) => {
        const user = await requireUserFromInternalRequest({ req, reply, env });
        if (!user) return;

        const latest = await prisma.insightsDoc.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" }
        });

        return {
            latest: latest
                ? {
                    id: latest.id,
                    createdAt: latest.createdAt,
                    markdown: sanitizeInsightsMarkdown(latest.markdown).markdown,
                    diffFromPrev: latest.diffFromPrev,
                    pipelineRunId: latest.pipelineRunId
                }
                : null
        };
    });

    app.get("/history", async (req, reply) => {
        const user = await requireUserFromInternalRequest({ req, reply, env });
        if (!user) return;

        const docs = await prisma.insightsDoc.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            take: 50
        });

        return {
            docs: docs.map((d) => ({
                id: d.id,
                createdAt: d.createdAt,
                diffFromPrev: d.diffFromPrev,
                pipelineRunId: d.pipelineRunId
            }))
        };
    });

    app.get("/:id", async (req, reply) => {
        const user = await requireUserFromInternalRequest({ req, reply, env });
        if (!user) return;

        const id = (req.params as { id: string }).id;
        const doc = await prisma.insightsDoc.findFirst({ where: { id, userId: user.id } });

        return {
            doc: doc
                ? {
                    id: doc.id,
                    createdAt: doc.createdAt,
                    markdown: sanitizeInsightsMarkdown(doc.markdown).markdown,
                    diffFromPrev: doc.diffFromPrev,
                    pipelineRunId: doc.pipelineRunId
                }
                : null
        };
    });

    app.post("/rerun", async (req, reply) => {
        const user = await requireUserFromInternalRequest({ req, reply, env });
        if (!user) return;

        if (!env.INSIGHTS_ENABLED) {
            return reply.code(400).send({ error: "insights_disabled" });
        }

        const latestRun = await prisma.pipelineRun.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" }
        });
        if (!latestRun) {
            return reply.code(404).send({ error: "no_pipeline_run" });
        }

        const prev = await prisma.insightsDoc.findFirst({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" }
        });

        const previousMarkdown = prev?.markdown ?? "## Financial synthesis\n- Awaiting next update.\n";
        const metricsPack = latestRun.metricsPack ?? {};

        let nextMarkdown = previousMarkdown;
        let diffFromPrev: string | null = null;

        try {
            const diff = await generateInsightsUnifiedDiff({
                apiKey: env.OPENAI_API_KEY || "", // Not used by Tinker bridge but kept for type signature
                model: env.INSIGHTS_MODEL || "",
                previousMarkdown,
                metricsPack,
                systemPrompt: user.insightsSystemPrompt
            });

            nextMarkdown = applyUnifiedDiff({ previous: previousMarkdown, patch: diff });
            diffFromPrev = prev ? diff : null;
        } catch (err) {
            return reply
                .code(500)
                .send({ error: err instanceof Error ? err.message : "failed_to_rerun" });
        }

        const sanitized = sanitizeInsightsMarkdown(nextMarkdown);
        if (sanitized.changed) {
            diffFromPrev = null;
            nextMarkdown = sanitized.markdown;
        }

        const doc = await prisma.insightsDoc.create({
            data: {
                userId: user.id,
                markdown: nextMarkdown,
                diffFromPrev,
                metricsPack,
                pipelineRunId: latestRun.id
            }
        });

        return reply.code(200).send({ ok: true, docId: doc.id, pipelineRunId: latestRun.id });
    });
}
