function normalizeForCompare(s: string): string {
    return s.replace(/\r\n/g, "\n").trim();
}

export function sanitizeInsightsMarkdown(markdown: string): { markdown: string; changed: boolean } {
    const input = markdown ?? "";
    const lines = input
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const bullets: string[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
        if (!line.startsWith("-")) continue;

        const text = line.replace(/^-+\s*/, "").trim();
        if (!text) continue;

        const normalized = `- ${text}`;
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        bullets.push(normalized);
    }

    const maxBullets = 12;
    let finalBullets = bullets;

    if (finalBullets.length > maxBullets) {
        const numbersIndex = finalBullets.findIndex((b) => b.toLowerCase().startsWith("- **numbers used:**"));
        if (numbersIndex !== -1) {
            const numbersBullet = finalBullets[numbersIndex]!;
            const others = finalBullets.filter((_, i) => i !== numbersIndex);
            finalBullets = [...others.slice(0, maxBullets - 1), numbersBullet];
        } else {
            finalBullets = finalBullets.slice(0, maxBullets);
        }
    }

    const next = `## Financial synthesis\n${finalBullets.length ? finalBullets.join("\n") : "- Awaiting next update."
        }\n`;

    return {
        markdown: next,
        changed: normalizeForCompare(input) !== normalizeForCompare(next)
    };
}
