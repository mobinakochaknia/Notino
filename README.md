# Notino 📝


A fast, local-first, Notion-style note-taking app built with vanilla JavaScript and full RTL Persian support — no frameworks, no dependencies.

## Overview

Notino (نوتینو) is a single-page note-taking application inspired by Notion, built entirely with plain HTML, CSS, and JavaScript. It runs fully client-side and persists data in the browser's `localStorage`, making it a lightweight, dependency-free knowledge base that works offline.

The UI is designed right-to-left (RTL) for Persian, with the Vazirmatn font and a warm, editorial visual style.

## Features

- **Notes & folders** — create, rename, move, and delete notes and folders
- **Pinning** — pin important notes for quick access
- **Search** — instant client-side search across all notes
- **Sorting** — sort by last updated, creation date, or title
- **Markdown editor** — write in Markdown with a live preview mode (bold, italic, underline, lists, custom text color)
- **Light/Dark theme** — toggleable, persisted across sessions
- **Import / Export** — back up or restore all notes and folders as a single JSON file
- **Responsive layout** — dedicated mobile header and collapsible sidebar
- **Zero dependencies** — no build step, no npm packages, no frameworks

## Tech Stack

- **HTML5** — semantic structure, modal dialogs
- **CSS3** — custom properties (CSS variables) for theming, responsive layout, Vazirmatn web font
- **Vanilla JavaScript (ES6+)** — flat state object + render-function architecture, custom Markdown parser, `localStorage` for persistence
- No external JS libraries or frameworks are used

## Project Structure

```
notino/
├── index.html      # App shell, sidebar, editor, modals
├── style.css       # Theming, layout, and component styles
└── script.js       # App state, rendering, Markdown parsing, storage
```

## Getting Started

No build tools or installation required.

1. Clone the repository
2. Open `index.html` directly in any modern browser

```bash
git https://github.com/mobinakochaknia/Notino.git
cd notino
open index.html   # or just double-click the file
```

All data is stored locally in your browser; nothing is sent to a server.

## Notes

This project was built as a hands-on exercise in building a full-featured single-page application using only core web platform APIs — no frameworks, no bundlers.
