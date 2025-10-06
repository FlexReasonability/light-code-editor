import React, { forwardRef, useMemo } from "react";

export interface GutterProps {
	/** nombre de lignes à afficher */
	lineCount: number;
	/** première ligne (1 par défaut) */
	start?: number;
	/** padding vertical en px (doit matcher l’editor) */
	vpad?: number;
	/** largeur en ch (digits) */
	widthCh?: number;
	/** couleurs */
	bg?: string;
	fg?: string;
}

export const Gutter = forwardRef<HTMLDivElement, GutterProps>(function Gutter(
	{
		lineCount,
		start = 1,
		vpad = 12,
		widthCh = 4,
		bg = "transparent",
		fg = "#6b7280",
	},
	ref
) {
	const lines = useMemo(() => {
		const arr = new Array(lineCount);
		for (let i = 0; i < lineCount; i++) arr[i] = String(start + i);
		return arr;
	}, [lineCount, start]);

	const style: React.CSSProperties = {
		position: "absolute",
		top: 0,
		left: 0,
		bottom: 0,
		width: `calc(${widthCh}ch + 16px)`, // un peu d’air à droite
		paddingTop: vpad,
		paddingBottom: vpad,
		paddingLeft: 8,
		paddingRight: 8,
		background: bg,
		color: fg,
		textAlign: "right",
		userSelect: "none",
		pointerEvents: "none",
		// même métrique que le code
		font: '14px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
		whiteSpace: "pre",
		overflow: "hidden",
		zIndex: 2,
	};

	return (
		<div ref={ref} style={style} aria-hidden>
			{lines.map((n, i) => (i === lineCount - 1 ? n : n + "\n"))}
		</div>
	);
});
