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
    "You are a health insights writer. You MUST output ONLY a unified diff patch. " +
    "The patch must transform the previous markdown into an updated markdown. " +
    "Do not wrap in code fences. Do not include any commentary. " +
    "Use file names 'a/insights.md' and 'b/insights.md'.";

  const user =
    "Update the insights document using the provided metrics pack. " +
    "Keep it grounded: only claim what the numbers support. " +
    "Include a section titled '## Numbers used' near the end, listing the exact numbers referenced.\n\n" +
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
