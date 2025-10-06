import type { SimpleRule } from "../types";

export const ident = "[a-zA-Z_][a-zA-Z0-9_]*";
export const numberRe =
	/\b(?:0[bB][01_]+|0[oO][0-7_]+|0[xX][\da-fA-F_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d[\d_]*)?)\b/g;
export const stringDq = /"(?:[^"\\\n]|\\.|\n)*"/g;
export const stringSq = /'(?:[^'\\\n]|\\.|\n)*'/g;

export function kw(list: string[]): SimpleRule[] {
	const re = new RegExp(`\\b(?:${list.join("|")})\\b`, "g");
	return [{ kind: "regex", pattern: re, type: "keyword", priority: 9 }];
}
