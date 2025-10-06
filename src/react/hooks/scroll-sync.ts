import { RefObject, useEffect } from "react";

/**
 * Synchronise le scroll vertical (et horizontal) du textarea
 * avec le <pre> (code coloré) et, si fourni, la gouttière.
 * On utilise un transform pour éviter un reflow coûteux.
 */
export function useScrollSync(
	taRef: RefObject<HTMLTextAreaElement>,
	preRef: RefObject<HTMLElement>,
	gutterRef?: RefObject<HTMLElement | null>
) {
	useEffect(() => {
		const ta = taRef.current;
		const pre = preRef.current;
		const gut = gutterRef?.current ?? null;
		if (!ta || !pre) return;

		const onScroll = () => {
			const x = ta.scrollLeft;
			const y = ta.scrollTop;
			pre.style.transform = `translate(${-x}px, ${-y}px)`;
			if (gut) gut.style.transform = `translateY(${-y}px)`;
		};

		// init
		onScroll();
		ta.addEventListener("scroll", onScroll);
		return () => ta.removeEventListener("scroll", onScroll);
	}, [taRef, preRef, gutterRef]);
}
