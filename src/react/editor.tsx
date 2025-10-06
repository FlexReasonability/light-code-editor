import React, {
	useMemo,
	useRef,
	useEffect,
	useState,
	forwardRef,
	useImperativeHandle,
} from "react";
import { tokenize } from "../core/tokenizer";
import { tokensToHTML } from "../core/renderer";
import type { Language, Theme } from "../types";
import { Gutter } from "./gutter";
import { useScrollSync } from "./hooks/scroll-sync";

export interface EditorProps {
	value: string;
	onChange?: (v: string) => void;
	language: Language;
	theme: Theme;
	className?: string;
	placeholder?: string;
	highlightActivePair?: boolean;
	readOnly?: boolean;
	/** Afficher la numérotation des lignes */
	showLineNumbers?: boolean;
	/** Premier numéro de ligne (par défaut 1) */
	lineNumberStart?: number;
}

export interface EditorHandle {
	focus: () => void;
	setValue: (v: string) => void;
	getValue: () => string;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
	{
		value,
		onChange,
		language,
		theme,
		className,
		placeholder,
		highlightActivePair,
		readOnly = false,
		showLineNumbers = false,
		lineNumberStart = 1,
	},
	ref
) {
	const [text, setText] = useState(value);
	const taRef = useRef<HTMLTextAreaElement | null>(null);
	const preRef = useRef<HTMLPreElement | null>(null);
	const gutterRef = useRef<HTMLDivElement | null>(null);

	useImperativeHandle(
		ref,
		() => ({
			focus: () => taRef.current?.focus(),
			setValue: (v) => setText(v),
			getValue: () => text,
		}),
		[text]
	);

	useEffect(() => setText(value), [value]);

	const tokens = useMemo(() => tokenize(text, language), [text, language]);
	const html = useMemo(
		() => tokensToHTML(text, tokens, theme),
		[text, tokens, theme]
	);

	// sync scroll entre textarea / pre / gutter
	useScrollSync(taRef, preRef, showLineNumbers ? gutterRef : undefined);

	// métriques communes
	const lineCount = useMemo(
		() => (text.length ? text.split("\n").length : 1),
		[text]
	);
	const vpad = 12;
	const gutterWidthCh = 4; // largeur de la zone numéros

	// styles inline (évite PostCSS)
	const containerStyle: React.CSSProperties = {
		position: "relative",
		font: '14px/1.6 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
	};

	const leftPadWhenGutter = `calc(${gutterWidthCh}ch + 16px + 8px)`; // width + paddingRight + paddingLeft

	const preStyle: React.CSSProperties = {
		margin: 0,
		whiteSpace: "pre",
		// @ts-ignore
		tabSize: 2,
		paddingTop: vpad,
		paddingBottom: vpad,
		paddingLeft: showLineNumbers ? leftPadWhenGutter : 12,
		paddingRight: 12,
		pointerEvents: "none",
		transform: "translate(0,0)", // sera mis à jour par le hook
		background: theme.background ?? "transparent",
		color: theme.foreground ?? "inherit",
	};

	const taStyle: React.CSSProperties = {
		position: "absolute",
		inset: 0,
		paddingTop: vpad,
		paddingBottom: vpad,
		paddingLeft: showLineNumbers ? leftPadWhenGutter : 12,
		paddingRight: 12,
		border: 0,
		outline: "none",
		resize: "none",
		background: "transparent",
		zIndex: 1,
		color: "transparent",
		// @ts-ignore - Safari/Chromium
		WebkitTextFillColor: "transparent",
		caretColor: readOnly ? "transparent" : theme.caret ?? "#7dd3fc",
		font: "inherit",
		lineHeight: "inherit",
		whiteSpace: "pre",
		// @ts-ignore
		tabSize: 2,
		textShadow: "none",
		cursor: readOnly ? "default" : "text",
	};

	function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
		if (readOnly) return;
		const v = e.target.value;
		setText(v);
		onChange?.(v);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (!readOnly) return;
		const code = e.key.toLowerCase();
		const block =
			["backspace", "delete", "enter", "tab"].includes(code) ||
			((e.ctrlKey || e.metaKey) && (code === "v" || code === "x"));
		if (block) e.preventDefault();
	}

	return (
		<div
			className={"mini-editor " + (className ?? "")}
			style={containerStyle}
			data-readonly={readOnly ? "true" : "false"}
		>
			{showLineNumbers && (
				<Gutter
					ref={gutterRef}
					lineCount={lineCount}
					start={lineNumberStart}
					vpad={vpad}
					widthCh={gutterWidthCh}
					bg={theme.gutter ?? "transparent"}
					fg={"#6b7280"}
				/>
			)}

			<pre
				className="mini-editor__code"
				aria-hidden="true"
				ref={preRef}
				style={preStyle}
				dangerouslySetInnerHTML={{
					__html:
						html ||
						(placeholder
							? `<span class='placeholder' style="opacity:.5">${placeholder}</span>`
							: ""),
				}}
			/>
			<textarea
				ref={taRef}
				className="mini-editor__input"
				spellCheck={false}
				style={taStyle}
				value={text}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				readOnly={readOnly}
				aria-readonly={readOnly}
				aria-label="Code editor"
			/>
		</div>
	);
});
