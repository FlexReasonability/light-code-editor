import type { Language, Rule } from "../types";

export function extendLanguage(
	base: Language,
	id: string,
	extraRules: Rule[],
	name?: string
): Language {
	return {
		id,
		name: name ?? id,
		rules: [...base.rules, ...extraRules],
		postprocess: base.postprocess,
	};
}
