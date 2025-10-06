import { Language, Token } from "../types";
import { bySpanPriority, selectNonOverlapping } from "./priority";
import { applyRainbowBrackets } from "./rainbow-brackets";

/** Tokenize text using a Language definition (regex + composite rules). */
export function tokenize(input: string, language: Language): Token[] {
	const candidates: Token[] = [];

	const push = (t: Token) => candidates.push(t);

	for (const rule of language.rules) {
		const re = new RegExp(
			rule.pattern.source,
			rule.pattern.flags.includes("g")
				? rule.pattern.flags
				: rule.pattern.flags + "g"
		);
		let m: RegExpExecArray | null;
		while ((m = re.exec(input))) {
			if (rule.kind === "regex") {
				push({
					from: m.index,
					to: m.index + m[0].length,
					type: rule.type,
					priority: rule.priority,
				});
			} else {
				rule.emit(input, m as unknown as RegExpMatchArray, (t) =>
					push({ ...t, priority: t.priority ?? rule.priority })
				);
			}
			if (m[0].length === 0) re.lastIndex++; // avoid zero-length loops
		}
	}

	candidates.sort(bySpanPriority);
	let chosen = selectNonOverlapping(candidates);
	chosen = language.postprocess ? language.postprocess(chosen, input) : chosen;

	// Active < > pour types seulement (TypeScript/TSX), pas pour JS/JSX
	const enableAngles = /ts/i.test(language.id);

	chosen = applyRainbowBrackets(input, chosen, { enableAngles });

	return chosen;
}
