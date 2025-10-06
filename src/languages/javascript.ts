// src/languages/javascript.ts
import type { Language, Token } from "../types";
import { ident, numberRe, stringDq, stringSq, kw } from "./shared";

/** mots-clés principaux (JS + ESNext) */
const jsKeywords = [
	"break",
	"case",
	"catch",
	"class",
	"const",
	"continue",
	"debugger",
	"default",
	"delete",
	"do",
	"else",
	"export",
	"extends",
	"finally",
	"for",
	"function",
	"if",
	"import",
	"in",
	"instanceof",
	"let",
	"new",
	"return",
	"super",
	"switch",
	"this",
	"throw",
	"try",
	"typeof",
	"var",
	"void",
	"while",
	"with",
	"yield",
	"await",
	"of",
	"as",
	"from",
];

/** Template literals: segmentation en `string` + marqueur d'entrée d'interpolation `${` */
const templateRe = /`[\s\S]*?`/g;
function emitTemplate(
	input: string,
	m: RegExpMatchArray,
	push: (t: Token) => void
) {
	const start = m.index!;
	const raw = m[0];
	const abs = (i: number) => start + i;

	let i = 0;
	let depth = 0;
	let segStart = 0; // début du segment string courant
	let interpStart = -1; // position du '${' (sur '$')

	while (i < raw.length) {
		const ch = raw[i];
		const prev = i > 0 ? raw[i - 1] : "";

		// entrée d'interpolation ${ (non échappée)
		if (ch === "$" && raw[i + 1] === "{" && prev !== "\\") {
			// flush du texte "string" avant le ${ ...
			if (i > segStart)
				push({ from: abs(segStart), to: abs(i), type: "string", priority: 10 });

			// marque uniquement l'entrée `${` (2 chars) pour laisser les accolades au rainbow
			interpStart = i;
			push({
				from: abs(interpStart),
				to: abs(interpStart + 2),
				type: "interpolation",
				priority: 12,
			});

			// consomme jusqu'à la } correspondante
			i += 2;
			depth = 1;
			while (i < raw.length && depth > 0) {
				const c = raw[i];
				const p = raw[i - 1];
				if (c === "{" && p !== "\\") depth++;
				else if (c === "}" && p !== "\\") depth--;
				i++;
			}
			// on repart après la }
			segStart = i;
			continue;
		}

		// backtick fermant non échappé
		if (ch === "`" && prev !== "\\") {
			i++; // inclure le ` final
			break;
		}

		i++;
	}

	// flush du dernier segment string (y compris le ` de fin)
	if (i > segStart) {
		push({ from: abs(segStart), to: abs(i), type: "string", priority: 10 });
	}
}

/** Heuristique regex literal: contexte autorisant un /regex/ plutôt qu’une division */
const regexLiteral = new RegExp(
	String.raw`(?<=^|[=(:,;!&|?{}\[\]\+\-\*\/~%^<>]\s*)\/(?![*/])(?:\\.|` +
		String.raw`\[(?:\\.|[\s\S])*?\]|[^\/\\\n\r])+\/[dgimsuvy]*\b`,
	"g"
);

export const javascript: Language = {
	id: "javascript",
	name: "JavaScript",
	rules: [
		// commentaires
		{ kind: "regex", pattern: /\/\/.*$/gm, type: "comment", priority: 10 },
		{
			kind: "regex",
			pattern: /\/\*[\s\S]*?\*\//g,
			type: "comment",
			priority: 10,
		},

		// mots-clés
		...kw(jsKeywords),

		// nombres (hex/bin/oct/dec, exposants, séparateurs, BigInt 'n')
		{ kind: "regex", pattern: numberRe, type: "number", priority: 6 },
		{ kind: "regex", pattern: /\b\d[\d_]*n\b/g, type: "number", priority: 6 },

		// strings classiques
		{ kind: "regex", pattern: stringDq, type: "string", priority: 6 },
		{ kind: "regex", pattern: stringSq, type: "string", priority: 6 },

		// template literals (segmentation + marqueur `${`)
		{
			kind: "composite",
			pattern: templateRe,
			emit: emitTemplate,
			priority: 11,
		},

		// littéraux RegExp /.../flags (heuristique)
		{ kind: "regex", pattern: regexLiteral, type: "regex", priority: 7 },

		// identifiants
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

		// ponctuation & opérateurs modernes
		{
			kind: "regex",
			pattern: /[{}()[\].,;:?<>]/g,
			type: "punctuation",
			priority: 1,
		},
		{ kind: "regex", pattern: /\.\.\.|=>/g, type: "operator", priority: 2 },
		{
			kind: "regex",
			pattern: /\?\?=?|\?\.(?:\(|\[)?/g,
			type: "operator",
			priority: 2,
		},
		{
			kind: "regex",
			pattern: /(?:&&|\|\||\*\*|<<|>>>?|[+\-*/%&|^!=<>]=?)/g,
			type: "operator",
			priority: 1,
		},
	],
};
