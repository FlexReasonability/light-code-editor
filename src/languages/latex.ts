// src/languages/latex.ts
import type { Language, Token } from "../types";

/**
 * Objectifs de coloration LaTeX (sans sur-encadrer le contenu) :
 * - Commentaires : %
 * - Commandes : \command, \\, \{ \} \% \& \_ \^ ~
 * - Environnements : \begin{env} / \end{env}  (nom d'env coloré)
 * - Délimiteurs math : $, $$, \(...\), \[...\]  (on ne wrappe que les délimiteurs)
 * - Labels/refs/cites : \label{key}, \ref{key}, \cite{key} …  (clé colorée en `variable`)
 * - Nombres (avec unités usuelles) : 12pt, 0.5cm…
 * - Ponctuation & opérateurs usuels
 *
 * Remarque : on n’entoure pas des blocs complets (ex: math inline) pour ne pas neutraliser
 * la mise en couleur fine (rainbow, commandes à l’intérieur, etc.).
 */

// 1) Commentaires
const commentRe = /%.*/gm;

// 2) Commandes simples \command  (lettres/@)
const controlSeqRe = /\\[A-Za-z@]+/g;

// 3) Séquences d'échappement spéciales : \\, \{, \}, \$, \%, \&, \_, \^, \~, \#, \textbackslash
const escapesRe = /\\[\\{}\$\%&#_^~]/g;

// 4) \begin{env} / \end{env}  -> on colore "begin"/"end" en keywordDecl et le nom d'env en type
const beginEndRe = /\\(begin|end)\s*\{[^}]*\}/g;
function emitBeginEnd(
	input: string,
	m: RegExpMatchArray,
	push: (t: Token) => void
) {
	const start = m.index!;
	const raw = m[0];
	// mot-clé begin/end
	const kw = /\b(begin|end)\b/.exec(raw);
	if (kw) {
		const kwFrom = start + kw.index!;
		push({
			from: kwFrom - 1 /* inclure le backslash ? non */,
			to: kwFrom + kw[0].length,
			type: "keywordDecl",
			priority: 9,
		});
	}
	// nom d'environnement dans { ... }
	const env = /\{([^}]*)\}/.exec(raw);
	if (env) {
		const envName = env[1];
		const envFrom = start + env.index! + 1;
		push({
			from: envFrom,
			to: envFrom + envName.length,
			type: "type",
			priority: 9,
		});
	}
}

// 5) Délimiteurs math : $, $$, \[, \], \(, \)
const mathDelimsRe = /(?:\$\$|\$|\\\[|\\\]|\\\(|\\\))/g;

// 6) Labels/refs/cites : on colore la clé interne comme `variable`
const refLike = [
	"label",
	"ref",
	"eqref",
	"pageref",
	"autoref",
	"nameref",
	"vref",
	"Vref",
	"cref",
	"Cref",
	"cite",
	"citep",
	"citet",
	"citet*",
	"citep*",
	"citeauthor",
	"citeyear",
];
const refLikeRe = new RegExp(
	String.raw`\\(?:${refLike.join("|")})\s*\{([^}]*)\}`,
	"g"
);
function emitRefLike(
	input: string,
	m: RegExpMatchArray,
	push: (t: Token) => void
) {
	const start = m.index!;
	const whole = m[0];
	const key = m[1] ?? "";
	const rel = whole.indexOf(key);
	if (rel >= 0 && key.length > 0) {
		const from = start + rel;
		push({ from, to: from + key.length, type: "variable", priority: 8 });
	}
}

// 7) Nombres (avec unités latex fréquentes)
const numberUnitRe = /\b\d+(?:\.\d+)?(?:pt|bp|mm|cm|in|ex|em|pc)?\b/g;

// 8) Ponctuation / opérateurs
const punctuationRe = /[{}\[\](),.;:]/g;
const operatorRe = /[+\-*/=^&_]/g;

export const latex: Language = {
	id: "latex",
	name: "LaTeX",
	rules: [
		// Commentaires
		{ kind: "regex", pattern: commentRe, type: "comment", priority: 10 },

		// Environnements \begin{env} / \end{env}
		{ kind: "composite", pattern: beginEndRe, emit: emitBeginEnd, priority: 9 },

		// Séquences d'échappement spéciales
		{ kind: "regex", pattern: escapesRe, type: "operator", priority: 8 },

		// Commandes \command
		{ kind: "regex", pattern: controlSeqRe, type: "function", priority: 7 },

		// Délimiteurs math seulement (on laisse le contenu se colorer via les autres règles)
		{ kind: "regex", pattern: mathDelimsRe, type: "operator", priority: 7 },

		// Labels / refs / cites (clé à l'intérieur)
		{ kind: "composite", pattern: refLikeRe, emit: emitRefLike, priority: 8 },

		// Nombres + unités
		{ kind: "regex", pattern: numberUnitRe, type: "number", priority: 6 },

		// Ponctuation & opérateurs
		{ kind: "regex", pattern: punctuationRe, type: "punctuation", priority: 1 },
		{ kind: "regex", pattern: operatorRe, type: "operator", priority: 1 },
	],
};
