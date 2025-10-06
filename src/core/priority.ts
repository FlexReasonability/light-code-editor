export function bySpanPriority(
	a: { from: number; to: number; priority?: number },
	b: { from: number; to: number; priority?: number }
) {
	if (a.from !== b.from) return a.from - b.from;
	const lenA = a.to - a.from;
	const lenB = b.to - b.from;
	const pA = a.priority ?? 0;
	const pB = b.priority ?? 0;
	if (pA !== pB) return pB - pA; // higher first
	return lenB - lenA; // longer first
}

export function selectNonOverlapping<T extends { from: number; to: number }>(
	items: T[]
): T[] {
	const out: T[] = [];
	let cursor = -1;
	for (const it of items) {
		if (it.from >= cursor) {
			out.push(it);
			cursor = it.to;
		}
	}
	return out;
}
