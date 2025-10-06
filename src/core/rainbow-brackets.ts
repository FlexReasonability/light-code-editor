import type { Token, TokenType } from "../types";
import { bySpanPriority, selectNonOverlapping } from "./priority";

const EXCLUDE: TokenType[] = ["string", "comment", "regex", "attrValue"];
const OPEN_SIMPLE = new Set(["(", "{", "["]);
const MATCH: Record<string, string> = {
	")": "(",
	"}": "{",
	"]": "[",
	">": "<",
};

type Frame = { ch: string; index: number; depth: number };

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

/** Heuristique: < … > de types (TS/TSX), pas JSX, pas opérateur. */
function isLikelyTypeAngleOpen(
	input: string,
	i: number,
	jsxAngles: Set<number>
): boolean {
	if (jsxAngles.has(i)) return false; // délimiteur JSX
	const n = input[i + 1];
	if (n === "=" || n === "<" || n === "/") return false; // <=, <<, </
	const pn = prevNonSpace(input, i);
	const nn = nextNonSpace(input, i);
	if (pn < 0 || nn < 0) return false;
	// Avant: ident/)/]/}/> ; Après: ident ou { [
	if (!(isIdentChar(input[pn]) || ")]}>".includes(input[pn]))) return false;
	if (!(isIdentChar(input[nn]) || "{[".includes(input[nn]))) return false;
	return true;
}
function isLikelyTypeAngleClose(
	input: string,
	i: number,
	jsxAngles: Set<number>
): boolean {
	if (jsxAngles.has(i)) return false; // délimiteur JSX
	const p = input[i - 1];
	if (p === "=") return false; // >=
	const nn = nextNonSpace(input, i);
	// Après: fins plausibles de génériques
	return nn === -1 || ")]},;:|&=>.".includes(input[nn]) || input[nn] === "(";
}

/**
 * Ajoute les tokens bracket0/1/2 (profondeur%3) pour (), {}, [], et — si activé —
 * pour < > de types (hors JSX). Merge trié + non-chevauchant avec les tokens existants.
 */
export function applyRainbowBrackets(
	input: string,
	base: Token[],
	opts?: { enableAngles?: boolean }
): Token[] {
	// Ranges à ignorer (strings, comments, etc.)
	const excluded = base
		.filter((t) => EXCLUDE.includes(t.type))
		.sort((a, b) => a.from - b.from)
		.map((t) => ({ from: t.from, to: t.to }));

	// Positions < > provenant du JSX (délimiteurs marqués meta.jsx)
	const jsxAnglePos = new Set<number>();
	for (const t of base) {
		if (
			t.type === "punctuation" &&
			t.meta &&
			(t.meta as any).jsx &&
			((t.meta as any).ch === "<" || (t.meta as any).ch === ">")
		) {
			jsxAnglePos.add(t.from);
		}
	}

	let skipIdx = 0;
	const inExcluded = (pos: number) => {
		while (skipIdx < excluded.length && excluded[skipIdx].to <= pos) skipIdx++;
		const s = excluded[skipIdx];
		return !!s && s.from <= pos && pos < s.to;
	};

	const out: Token[] = [];
	const stack: Frame[] = [];

	for (let i = 0; i < input.length; i++) {
		if (inExcluded(i)) continue;
		const ch = input[i];

		// OUVRANTS simples
		if (OPEN_SIMPLE.has(ch)) {
			const depth = stack.length;
			const kind = ("bracket" + (depth % 3)) as TokenType;
			out.push({ from: i, to: i + 1, type: kind, priority: 20 });
			stack.push({ ch, index: i, depth });
			continue;
		}

		// OUVRANT angle < (types seulement, si activé)
		if (
			opts?.enableAngles &&
			ch === "<" &&
			isLikelyTypeAngleOpen(input, i, jsxAnglePos)
		) {
			// Cherche un '>' plausible plus loin (hors JSX)
			let j = i + 1;
			let found = -1;
			while (j < input.length) {
				if (inExcluded(j)) {
					j++;
					continue;
				}
				if (jsxAnglePos.has(j)) {
					j++;
					continue;
				}
				if (input[j] === ">") {
					if (isLikelyTypeAngleClose(input, j, jsxAnglePos)) {
						found = j;
						break;
					}
				}
				j++;
				if (j - i > 2000) break; // stop heuristique
			}
			if (found !== -1) {
				const depth = stack.length;
				const kind = ("bracket" + (depth % 3)) as TokenType;
				out.push({ from: i, to: i + 1, type: kind, priority: 20 });
				stack.push({ ch, index: i, depth });
				continue;
			}
		}

		// FERMANTS ) } ] et angle >
		if (
			ch === ")" ||
			ch === "}" ||
			ch === "]" ||
			(opts?.enableAngles &&
				ch === ">" &&
				isLikelyTypeAngleClose(input, i, jsxAnglePos))
		) {
			const want = MATCH[ch];
			if (!want) continue;
			let k = stack.length - 1;
			while (k >= 0 && stack[k].ch !== want) k--;
			if (k === -1) continue; // orphelin
			const open = stack[k];
			stack.length = k; // pop jusqu’au match
			const kind = ("bracket" + (open.depth % 3)) as TokenType;
			out.push({ from: i, to: i + 1, type: kind, priority: 20 });
			continue;
		}
	}

	// Merge + tri + non-chevauchement
	const merged = [...base, ...out];
	merged.sort(bySpanPriority);
	return selectNonOverlapping(merged);
}
