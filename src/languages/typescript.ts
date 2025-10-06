// src/languages/typescript.ts
import type { Language, Token } from "../types";
import { javascript } from "./javascript";
import { extendLanguage } from "./utils";
import { kw } from "./shared";

/** Déclaratifs */
const tsDeclKeywords = ["interface", "type", "enum", "namespace", "module"];

/** Extras TS */
const tsExtraKeywords = [
	"public",
	"private",
	"protected",
	"readonly",
	"abstract",
	"override",
	"static",
	"keyof",
	"infer",
	"unique",
	"satisfies",
	"asserts",
	"is",
	"implements",
	"declare",
	"global",
];

/** Primitives de type TS */
const tsPrimitiveTypes = [
	"string",
	"number",
	"boolean",
	"bigint",
	"symbol",
	"object",
	"unknown",
	"never",
	"any",
	"void",
	"null",
	"undefined",
];

/** utilitaires */
const ident = /[A-Za-z_]\w*/y;
function isIdentChar(c: string) {
	return /[A-Za-z0-9_$]/.test(c);
}
function prevNonSpace(input: string, i: number) {
	let k = i - 1;
	while (k >= 0 && /\s/.test(input[k])) k--;
	return k;
}
function nextNonSpace(input: string, i: number) {
	let k = i + 1;
	while (k < input.length && /\s/.test(input[k])) k++;
	return k < input.length ? k : -1;
}

function emitTypeIdentsInRange(
	input: string,
	from: number,
	to: number,
	push: (t: Token) => void
) {
	let i = from;
	while (i < to) {
		const ch = input[i];
		if ((ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_") {
			ident.lastIndex = i;
			const m = ident.exec(input);
			if (m) {
				let s = m.index,
					e = s + m[0].length;
				// qualifiés A.B.C
				while (e < to && input[e] === "." && isIdentChar(input[e + 1])) {
					let j = e + 1;
					while (j < to && isIdentChar(input[j])) j++;
					e = j;
				}
				push({ from: s, to: e, type: "type", priority: 9 });
				i = e;
				continue;
			}
		}
		i++;
	}
}

/** 1) Types après ':' (évite ternaire) — on bloque les backticks dans la capture */
const typeAfterColonRe = /:\s*([^=;{}()\n`]+)/g;
function emitTypesAfterColon(
	input: string,
	m: RegExpMatchArray,
	push: (t: Token) => void
) {
	const colonPos = m.index!;
	const pn = prevNonSpace(input, colonPos);
	if (pn >= 0 && input[pn] === "?") return; // éviter a ? b : c

	const whole = m[0];
	const body = m[1] ?? "";
	const bodyOffset = colonPos + whole.indexOf(body);
	emitTypeIdentsInRange(input, bodyOffset, bodyOffset + body.length, push);
}

/** 2) Types après `as` — on bloque les backticks */
const asTypeRe = /\bas\s+([^\s,;()<>[\]{}`]+)/g;
function emitTypesAfterAs(
	input: string,
	m: RegExpMatchArray,
	push: (t: Token) => void
) {
	const body = m[1] ?? "";
	const start = m.index! + m[0].indexOf(body);
	emitTypeIdentsInRange(input, start, start + body.length, push);
}

/** 3) `extends` / `implements` — on bloque les backticks */
const extendsImplRe = /\b(extends|implements)\s+([^{;`]+)/g;
function emitTypesAfterExtImpl(
	input: string,
	m: RegExpMatchArray,
	push: (t: Token) => void
) {
	const list = m[2] ?? "";
	const start = m.index! + m[0].indexOf(list);
	emitTypeIdentsInRange(input, start, start + list.length, push);
}

/** 4) Paramètres de type `<...>` — ne franchit pas un backtick */
const typeParamConstraintRe = /<[^>`]*>/g;
function emitTypesInTypeParams(
	input: string,
	m: RegExpMatchArray,
	push: (t: Token) => void
) {
	const start = m.index!;
	const end = start + m[0].length;
	emitTypeIdentsInRange(input, start, end, push);
}

/** Règles */
const declRule = {
	kind: "regex" as const,
	pattern: new RegExp(`\\b(?:${tsDeclKeywords.join("|")})\\b`, "g"),
	type: "keywordDecl" as const,
	priority: 9,
};
const primitivesRule = {
	kind: "regex" as const,
	pattern: new RegExp(`\\b(?:${tsPrimitiveTypes.join("|")})\\b`, "g"),
	type: "type" as const,
	priority: 6,
};
const decoratorRule = {
	kind: "regex" as const,
	pattern: /@\s*[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*/g,
	type: "builtin" as const,
	priority: 8,
};

export const typescript: Language = extendLanguage(
	javascript,
	"typescript",
	[
		declRule,
		...kw(tsExtraKeywords),
		primitivesRule,
		decoratorRule,
		{
			kind: "composite",
			pattern: typeAfterColonRe,
			emit: emitTypesAfterColon,
			priority: 9,
		},
		{
			kind: "composite",
			pattern: asTypeRe,
			emit: emitTypesAfterAs,
			priority: 9,
		},
		{
			kind: "composite",
			pattern: extendsImplRe,
			emit: emitTypesAfterExtImpl,
			priority: 9,
		},
		{
			kind: "composite",
			pattern: typeParamConstraintRe,
			emit: emitTypesInTypeParams,
			priority: 8,
		},
	],
	"TypeScript"
);
