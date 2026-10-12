# Pally usability test

Coded prototype of Pally's "create a match → review join requests" flow, built for usability testing.

- `src/screens/` — prototype screens (Task 1: create a match, Task 2: review requests)
- `src/motion.ts` — every animation timing in one place
- `src/data.ts` — the five requesters (A–E) and their name/photo sets per gender filter
- `src/log.ts` — behaviour log (screens, taps, taps on non-interactive areas, decisions)
- `src/assets/{icons,avatars,clubs,illustrations}` — exported Figma assets; files here replace the stand-ins automatically

Review shortcut: add `?screen=requests` (or `homeMatch`, `review`, `payment`…) to the URL to jump to a screen.

Run locally: `npm install && npm run dev`
