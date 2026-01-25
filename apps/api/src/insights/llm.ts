import { execSync } from "child_process";
import { FINANCE_INSIGHTS_DEFAULT_SYSTEM_PROMPT } from "@finance-agent/shared";

export async function generateInsightsUnifiedDiff(params: {
    apiKey: string;
    model: string;
    previousMarkdown: string;
    metricsPack: unknown;
    systemPrompt?: string | null;
}): Promise<string> {
    const { previousMarkdown, metricsPack, systemPrompt } = params;

    const baseSystem = FINANCE_INSIGHTS_DEFAULT_SYSTEM_PROMPT;
    const trimmedSystemPrompt = systemPrompt?.trim();
    const system = trimmedSystemPrompt ? `${baseSystem}\n\nUser preferences:\n${trimmedSystemPrompt}` : baseSystem;

    const user =
        "Update the financial insights document using the provided data.\n" +
        "Rules:\n" +
        "- Grounded: only claim what the numbers support.\n" +
        "- Be concise and actionable: 4–8 bullets total.\n" +
        "- Single heading only: start with exactly '## Financial synthesis'.\n" +
        "- Output must be ONLY the heading line and bullet lines. Every non-heading line MUST start with '- '.\n" +
        "- Include 1–2 'Next actions' bullets.\n" +
        "- Include EXACTLY ONE final bullet starting with '**Numbers used:**'.\n" +
        "- Keep the markdown stable: prefer updating existing bullet text.\n\n" +
        "PREVIOUS MARKDOWN:\n" +
        previousMarkdown +
        "\n\nFINANCE DATA (JSON):\n" +
        JSON.stringify(metricsPack);

    const modelPath = process.env.TINKER_MODEL_PATH || "tinker://1bdf299a-25aa-5110-877d-9ce6c42f64af:train:0/sampler_weights/insights-agent-model";
    const tinkerTrainingDir = "/home/hamish/Documents/Projects/TinkerTraining";

    try {
        const command = `./venv/bin/python generic_sample.py "${modelPath}" ${JSON.stringify(`FINANCE_SUMMARY: ${user}`)} ${JSON.stringify(system)}`;
        const output = execSync(command, { cwd: tinkerTrainingDir, encoding: "utf-8" });
        return output.trim();
    } catch (err) {
        console.error("Tinker bridge error:", err);
        throw new Error(`Tinker sampling failed: ${err instanceof Error ? err.message : String(err)}`);
    }
}
