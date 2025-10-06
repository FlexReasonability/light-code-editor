import type { Language, Token } from "../types";
import { ident, numberRe, stringDq, stringSq, kw } from "./shared";

const pyKeywords = [
	"and",
	"as",
	"assert",
	"break",
	"class",
	"continue",
	"def",
	"del",
	"elif",
	"else",
	"except",
	"False",
	"finally",
	"for",
	"from",
	"global",
	"if",
	"import",
	"in",
	"is",
	"lambda",
	"None",
	"nonlocal",
	"not",
	"or",
	"pass",
	"raise",
	"return",
	"True",
	"try",
	"while",
	"with",
	"yield",
];

// f-string parser: detects prefix f/F (possibly r/R too), handles triple quotes and nested { ... } with doubled braces escaping
const fStringRe =
	/(?<=^|[^a-zA-Z0-9_])([rR]?[fF]|[fF][rR])(?:("""|'''|"|'))([\s\S]*?)\2/gm;

function emitFString(
	input: string,
	m: RegExpMatchArray,
	push: (t: Token) => void
) {
	const full = m[0];
	const openQuote = m[2]!; // quote group
	const body = m[3] ?? "";
	const start = m.index!;
	// prefix length can be 1 or 2 (f / fr / rf)
	const prefixLen = full.indexOf(openQuote);
	// opening delimiter at start+prefixLen, closing at start+full.length-1 (exclusive)
	const stringStart = start;
	const stringEnd = start + full.length;
	// mark whole range as string (so theme can color it)
	push({ from: stringStart, to: stringEnd, type: "string", priority: 8 });

	// walk the body and find interpolations respecting doubled braces
	let i = 0;
	const bodyStart = start + prefixLen + openQuote.length;
	function pushInterp(s: number, e: number) {
		push({
			from: bodyStart + s,
			to: bodyStart + e,
			type: "interpolation",
			priority: 12,
		});
	}
	let depth = 0;
	let interpStart = -1;
	while (i < body.length) {
		const ch = body[i];
		const next = body[i + 1];
		if (ch === "{" && next === "{") {
			i += 2;
			continue;
		} // escaped `{{`
		if (ch === "}" && next === "}") {
			i += 2;
			continue;
		} // escaped `}}`
		if (ch === "{" && depth === 0) {
			depth = 1;
			interpStart = i;
			i++;
			continue;
		}
		if (ch === "{" && depth > 0) {
			depth++;
			i++;
			continue;
		}
		if (ch === "}" && depth > 0) {
			depth--;
			if (depth === 0 && interpStart >= 0) {
				// include the braces themselves
				pushInterp(interpStart, i + 1);
				interpStart = -1;
			}
			i++;
			continue;
		}
		i++;
	}
}

export const python: Language = {
	id: "python",
	name: "Python",
	rules: [
		{ kind: "regex", pattern: /#.*/g, type: "comment", priority: 10 },
		...kw(pyKeywords),
		{ kind: "regex", pattern: numberRe, type: "number", priority: 6 },
		// classic quoted strings
		{ kind: "regex", pattern: stringDq, type: "string", priority: 6 },
		{ kind: "regex", pattern: stringSq, type: "string", priority: 6 },
		// triple-quoted strings
		{ kind: "regex", pattern: /"""[\s\S]*?"""/g, type: "string", priority: 6 },
		{ kind: "regex", pattern: /'''[\s\S]*?'''/g, type: "string", priority: 6 },
		// f-strings with nested interpolation
		{ kind: "composite", pattern: fStringRe, emit: emitFString, priority: 11 },
		// names
		{
			kind: "regex",
			pattern: new RegExp(`\\b${ident}(?=\\s*\\()`, "g"),
			type: "function",
			priority: 7,
		},
		{
			kind: "regex",
			pattern: new RegExp(`(?<=\\.)${ident}`, "g"),
			type: "property",
			priority: 5,
		},
		{
			kind: "regex",
			pattern: new RegExp(`\\b${ident}\\b`, "g"),
			type: "variable",
			priority: 1,
		},
		{
			kind: "regex",
			pattern: /[{}()[\].,;:@]/g,
			type: "punctuation",
			priority: 1,
		},
		{
			kind: "regex",
			pattern: /[+\-*/%=&|^!<>]=?|\|\||&&|\*\*|:=/g,
			type: "operator",
			priority: 1,
		},
	],
};
