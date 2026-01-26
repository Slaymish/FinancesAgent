import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { FINANCE_INSIGHTS_DEFAULT_SYSTEM_PROMPT } from "@finance-agent/shared";
import { loadEnv } from "../env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    const { TINKER_MODEL_PATH, TINKER_BRIDGE_CMD } = loadEnv();
    const bridgeScriptPath = path.resolve(__dirname, "../../tinker_bridge.py");

    try {
        const command = `${TINKER_BRIDGE_CMD} "${bridgeScriptPath}" "${TINKER_MODEL_PATH}" ${JSON.stringify(`FINANCE_SUMMARY: ${user}`)} ${JSON.stringify(system)}`;
        const output = execSync(command, { encoding: "utf-8" });
        return output.trim();
    } catch (err) {
        console.error("Tinker bridge error:", err);
        throw new Error(`Tinker sampling failed: ${err instanceof Error ? err.message : String(err)}`);
    }
}
