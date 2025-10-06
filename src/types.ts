export type TokenType =
	| "comment"
	| "string"
	| "number"
	| "keyword"
	| "keywordDecl"
	| "boolean"
	| "null"
	| "regex"
	| "operator"
	| "punctuation"
	| "function"
	| "variable"
	| "property"
	| "type"
	| "namespace"
	| "builtin"
	| "interpolation"
	| "text"
	| "tag"
	| "attrName"
	| "attrValue"
	| "bracket0"
	| "bracket1"
	| "bracket2";

export interface Token {
	from: number; // inclusive
	to: number; // exclusive
	type: TokenType;
	priority?: number; // higher wins on overlaps
	meta?: Record<string, unknown>;
}

export type SimpleRule = {
	kind: "regex";
	pattern: RegExp; // must be global (/g)
	type: TokenType;
	priority?: number;
};

export type CompositeRule = {
	kind: "composite";
	/** A global regex whose match is further analyzed through `emit` */
	pattern: RegExp; // /g
	emit: (input: string, m: RegExpMatchArray, push: (t: Token) => void) => void;
	priority?: number;
};

export type Rule = SimpleRule | CompositeRule;

export interface Language {
	id: string;
	name?: string;
	rules: Rule[];
	/** Optionnel: pour affiner le post-traitement */
	postprocess?: (tokens: Token[], input: string) => Token[];
}

export type Theme = Partial<Record<TokenType, string>> & {
	background?: string;
	foreground?: string;
	caret?: string;
	selection?: string;
	gutter?: string;
};

export interface HighlightOptions {
	language: Language;
}
