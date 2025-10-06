import { Theme, Token } from "../types";
import { bySpanPriority } from "./priority";

export function tokensToHTML(
	input: string,
	tokens: Token[],
	theme: Theme
): string {
	// garde-fou : trier pour assurer l'ordre
	const list = [...tokens].sort(bySpanPriority);

	let html = "";
	let i = 0;
	for (const t of list) {
		if (t.from > i) html += escapeHTML(input.slice(i, t.from));
		if (t.to > i) {
			const cls = "tok-" + t.type;
			const style = themeToInline(t.type, theme);
			html +=
				`<span class="${cls}" style="${style}">` +
				escapeHTML(input.slice(Math.max(i, t.from), t.to)) +
				"</span>";
			i = t.to;
		}
	}
	if (i < input.length) html += escapeHTML(input.slice(i));
	return html;
}

function escapeHTML(s: string) {
	return s.replace(
		/[&<>\"]/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!)
	);
}

function themeToInline(kind: string, theme: Theme): string {
	const color = (theme as any)[kind];
	return color ? `color:${color}` : "";
}
