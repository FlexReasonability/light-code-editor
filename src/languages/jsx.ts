// src/languages/jsx.ts
import type { Language, Token } from "../types";
import { javascript } from "./javascript";
import { extendLanguage } from "./utils";

/**
 * Tags JSX :
 *  - nommés : <Div ...>, </Div>, <Div .../>
 *  - fragments : <> et </>
 */
const jsxTagRe = /(?:<\/?[A-Za-z][\w$.:~-]*(?:\s+[^<>]*?)?\s*\/?>)|(?:<\/?>)/g;

/** Segmente un template literal `...${...}...` en tokens non-chevauchants */
function emitTemplateSegments(
	absStart: number,
	raw: string,
	push: (t: Token) => void
) {
	const abs = (i: number) => absStart + i;

	let i = 0;
	let depth = 0;
	let segStart = 0; // début segment "string"
	let exprStart = -1; // début de ${ ... }

	while (i < raw.length) {
		const ch = raw[i];
		const prev = i > 0 ? raw[i - 1] : "";

		// ouverture d'expression ${…} (non échappée)
		if (ch === "$" && raw[i + 1] === "{" && prev !== "\\") {
			if (i > segStart) {
				// texte "string" avant l'interpolation
				push({ from: abs(segStart), to: abs(i), type: "string", priority: 10 });
			}
			exprStart = i;
			depth = 1;
			i += 2;
			// consomme jusqu'à la } correspondante
			while (i < raw.length && depth > 0) {
				const c = raw[i];
				const p = raw[i - 1];
				if (c === "{" && p !== "\\") depth++;
				else if (c === "}" && p !== "\\") depth--;
				i++;
			}
			// i est juste après la '}'
			push({
				from: abs(exprStart),
				to: abs(i),
				type: "interpolation",
				priority: 12,
			});
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

	// flush du dernier segment "string"
	if (i > segStart) {
		push({ from: abs(segStart), to: abs(i), type: "string", priority: 10 });
	}
}

/** Émetteurs pour un tag JSX (délimiteurs, noms, attrs, strings dans { ... }) */
function emitJSX(input: string, m: RegExpMatchArray, push: (t: Token) => void) {
	const base = m.index!;
	const raw = m[0];

	// Délimiteurs: '<', optionnel '/', puis '>'
	push({
		from: base,
		to: base + 1,
		type: "punctuation",
		priority: 15,
		meta: { jsx: true, ch: "<" },
	});
	const isClosing = raw.startsWith("</");
	if (isClosing) {
		push({
			from: base + 1,
			to: base + 2,
			type: "punctuation",
			priority: 15,
			meta: { jsx: true, ch: "/" },
		});
	}
	const gtPos = raw.lastIndexOf(">");
	if (gtPos >= 0) {
		if (!isClosing) {
			const before = raw.slice(0, gtPos);
			const mSlash = before.match(/\/\s*$/);
			if (mSlash) {
				const slashPos = gtPos - mSlash[0].length;
				push({
					from: base + slashPos,
					to: base + slashPos + 1,
					type: "punctuation",
					priority: 15,
					meta: { jsx: true, ch: "/" },
				});
			}
		}
		push({
			from: base + gtPos,
			to: base + gtPos + 1,
			type: "punctuation",
			priority: 15,
			meta: { jsx: true, ch: ">" },
		});
	}

	// Nom de balise (pas pour fragments)
	const nameMatch = /^<\/?\s*([A-Za-z][\w$.:~-]*)/.exec(raw);
	if (nameMatch) {
		const name = nameMatch[1];
		const namePos = raw.indexOf(name);
		push({
			from: base + namePos,
			to: base + namePos + name.length,
			type: "tag",
			priority: 12,
		});
	}

	// --------- Balises: calcul des zones { ... } de premier niveau ----------
	const braceRanges: Array<{ from: number; to: number }> = [];
	{
		let depth = 0;
		let start = -1;
		for (let i = 0; i < raw.length; i++) {
			const ch = raw[i];
			const prev = i > 0 ? raw[i - 1] : "";
			if (ch === "{" && prev !== "\\") {
				if (depth === 0) start = i;
				depth++;
			} else if (ch === "}" && prev !== "\\") {
				depth--;
				if (depth === 0 && start >= 0) {
					braceRanges.push({ from: start, to: i + 1 });
					start = -1;
				}
			}
		}
	}
	const inBrace = (pos: number) =>
		braceRanges.some((r) => r.from <= pos && pos < r.to);

	// --------- Attributs (clé=… et clés seules) HORS { ... } ----------
	{
		const attrNameEq = /([A-Za-z_:][\w:.-]*)(?=\s*=)/g;
		let nm: RegExpExecArray | null;
		while ((nm = attrNameEq.exec(raw))) {
			if (inBrace(nm.index)) continue;
			push({
				from: base + nm.index,
				to: base + nm.index + nm[1].length,
				type: "attrName",
				priority: 11,
			});
		}
	}
	{
		const loneAttr = /(^|[\s<])([A-Za-z_:][\w:.-]*)(?=(?:\s|\/?>))/g;
		let nm: RegExpExecArray | null;
		while ((nm = loneAttr.exec(raw))) {
			const idx = nm.index + nm[1].length;
			if (inBrace(idx)) continue;
			const len = nm[2].length;
			if (!nameMatch || idx > raw.indexOf(nameMatch[1]) + nameMatch[1].length) {
				push({
					from: base + idx,
					to: base + idx + len,
					type: "attrName",
					priority: 10,
				});
			}
		}
	}

	// --------- Valeurs d’attributs "…" et '…' (HORS { ... }) ----------
	{
		const dq = /"([^"\\]|\\.|[\n\r])*"/g;
		const sq = /'([^'\\]|\\.|[\n\r])*'/g;
		let vm: RegExpExecArray | null;
		while ((vm = dq.exec(raw))) {
			if (inBrace(vm.index)) continue;
			push({
				from: base + vm.index,
				to: base + vm.index + vm[0].length,
				type: "attrValue",
				priority: 10,
			});
		}
		while ((vm = sq.exec(raw))) {
			if (inBrace(vm.index)) continue;
			push({
				from: base + vm.index,
				to: base + vm.index + vm[0].length,
				type: "attrValue",
				priority: 10,
			});
		}
	}

	// --------- À l’INTÉRIEUR des { ... } : détecter les template literals et les segmenter ---------
	// On ne re-colorise pas tout JS ici (c’est fait par javascript.ts), on ajoute seulement
	// les segments "string"/"interpolation" des backticks, pour garantir la coloration correcte
	// dans des attributs comme: className={`font-sans ${x} y`}
	const tplRe = /`[\s\S]*?`/g;
	for (const range of braceRanges) {
		const relStart = range.from;
		const body = raw.slice(range.from, range.to); // inclut les accolades
		tplRe.lastIndex = 0;
		let tm: RegExpExecArray | null;
		while ((tm = tplRe.exec(body))) {
			const absStart = base + relStart + tm.index;
			emitTemplateSegments(absStart, tm[0], push);
			if (tm[0].length === 0) tplRe.lastIndex++; // garde-fou
		}
	}

	// --------- Accolades { } : ponctuation seulement (le JS interne est coloré par ailleurs) ---------
	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i];
		const prev = i > 0 ? raw[i - 1] : "";
		if (ch === "{" && prev !== "\\")
			push({
				from: base + i,
				to: base + i + 1,
				type: "punctuation",
				priority: 9,
			});
		else if (ch === "}" && prev !== "\\")
			push({
				from: base + i,
				to: base + i + 1,
				type: "punctuation",
				priority: 9,
			});
	}
}

export const jsx: Language = extendLanguage(javascript, "jsx", [
	{ kind: "composite", pattern: jsxTagRe, emit: emitJSX, priority: 12 },
]);
