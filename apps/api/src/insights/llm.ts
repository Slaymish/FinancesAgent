import { z } from "zod";

const chatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional()
        })
      })
    )
    .min(1)
});

export async function generateInsightsUnifiedDiff(params: {
  apiKey: string;
  model: string;
  previousMarkdown: string;
  metricsPack: unknown;
}): Promise<string> {
  const { apiKey, model, previousMarkdown, metricsPack } = params;

  const system =
    "You write a concise weekly health synthesis. " +
    "You MUST output ONLY a unified diff patch (no code fences, no commentary). " +
    "The patch must transform the previous markdown into an updated markdown. " +
    "Use file names 'a/insights.md' and 'b/insights.md'.";

  const user =
    "Update the insights document using the provided metrics pack.\n" +
    "Rules:\n" +
    "- Grounded: only claim what the numbers support; if missing, say 'Data missing' briefly.\n" +
    "- Be concise and actionable: 6–12 bullets total.\n" +
    "- Single heading only: start with exactly '## Weekly synthesis'. Do NOT use other headings (no '#', no '## Weight', etc.).\n" +
    "- Do NOT add empty lines or empty bullets. Every bullet must contain meaningful text.\n" +
    "- Include 1–3 'Next actions' bullets (specific, doable this week).\n" +
    "- Include a 'Numbers used' block at the end as bullets, listing the exact numbers you referenced.\n" +
    "- Keep the markdown stable: prefer updating existing bullet text over adding lots of new bullets.\n\n" +
    "Target markdown shape (example):\n" +
    "## Weekly synthesis\n" +
    "- **Weight:** <claim> (7d slope X, 14d slope Y; latest Z).\n" +
    "- **Nutrition:** <claim> (kcal 7d vs 14d; protein 7d vs 14d).\n" +
    "- **Training:** <claim> (sessions 7d vs 14d; minutes 7d vs 14d).\n" +
    "- **Sleep:** <claim> (avg 7d vs 14d).\n" +
    "- **Recovery:** <claim> (resting HR 7d vs 14d).\n" +
    "- **Next actions:** <one concrete action>.\n" +
    "- **Numbers used:** Weight …; Calories …; Protein …; Training …; Sleep …; Resting HR ….\n\n" +
    "PREVIOUS MARKDOWN:\n" +
    previousMarkdown +
    "\n\nMETRICS PACK (JSON):\n" +
    JSON.stringify(metricsPack, null, 2);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as unknown;
  const parsed = chatResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("OpenAI response did not match expected schema");
  }

  const content = parsed.data.choices[0]?.message.content;
  if (!content || content.trim().length === 0) {
    throw new Error("OpenAI response had empty content");
  }

  return content.trim();
}
