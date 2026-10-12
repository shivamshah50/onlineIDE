import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

/**
 * By default @monaco-editor/react fetches Monaco from a CDN at runtime,
 * while y-monaco statically imports the `monaco-editor` npm package
 * directly (monaco-editor/esm/vs/editor/editor.api.js) — that's the
 * "Failed to resolve import" Vite error if the package isn't installed.
 *
 * Installing the package alone isn't enough: without this, the <Editor>
 * component would still load its OWN Monaco from the CDN, a different
 * instance from the one y-monaco's MonacoBinding attaches to. Pointing the
 * loader at this same local `monaco` import makes both sides share exactly
 * one Monaco instance.
 *
 * Import this file once, before anything renders an <Editor> — see
 * Main.tsx.
 */
loader.config({ monaco });