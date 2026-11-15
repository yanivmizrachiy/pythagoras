---
name: pythagoras-safe-verify
description: Verify or resume the canonical Pythagoras workbook safely using the existing SSOT, manifest, validation, browser smoke tests and PDF provenance. Use when working on reader, pages, styling, embed, mobile or print. Do not alter production or other agents' branches.
---

# Pythagoras — safe focused workflow

Always apply the existing `SOURCE_OF_TRUTH.md` verbatim. This is a **procedure**, not a second requirements document. The sole canonical repository is `yanivmizrachiy/pythagoras`; keep its 53 A4 HTML pages and `WORKBOOK_MANIFEST.json` as the only page registry. `main` is canonical and `gh-pages` is the publishing mirror. No new runtime loader, exporter, validator or deployment platform.

## 0. Cheap preflight (read-only, before ANY edit)

Run from the confirmed repository root, not a guessed local folder:

```sh
git rev-parse --show-toplevel
git status --short
git branch --show-current
git rev-parse HEAD
git remote -v
```

Compare current branch and main only after safely fetching. If worktree is dirty, **do not reset, clean, stash, switch branches or overwrite files**. Check for a live agent/lease, concurrent PR and existing branch ownership. Stop and report the exact state if the owner/branch is unclear. Avoid duplicate sessions or a second worktree targeting an active branch.

## 1. Targeted changes, single owner

Read `SOURCE_OF_TRUTH.md` and the files actually in scope. For the standalone workbook, the reader is `index.html` plus `book-design.js`, while page order comes only from `WORKBOOK_MANIFEST.json`. For embedded pages in `jerusalem2`, first confirm the host integration separately; changes to that **other repo** require its own authorized branch and checks. Never change the standalone workbook merely to mask an embedding bug. Keep A4 typography and math accurate; preserve RTL, number of pages, direct links and one set of reader controls. `styles/topics/pythagoras.css` owns shared radical geometry; do not add per-page overrides.

## 2. Fast verification ladder (run only what the diff requires)

**Baseline / every source change:**

```sh
npm run validate
```

This is the project's *existing* canonical validator `tools/validate.js`, not a new test framework. Inspect failure details and PDF provenance; do not silently ignore a stale PDF or claim success from an unexecuted command.

**Reader, styling, navigation or responsive changes:** run `npm run start` in an isolated available terminal, then in another terminal run:

```sh
CHROME_BIN=/path/to/installed/chrome npm run smoke
```

`tools/smoke.js` targets `http://127.0.0.1:8080/` and needs an actual locally installed Chromium/Chrome executable; choose the **real** executable path for the environment, not the placeholder above. On Windows PowerShell, set `$env:CHROME_BIN` to the actual installed `chrome.exe` path and run `npm run smoke`. Do not mistake a browserless static parse for a passing browser test. On mobile/host changes verify one reader toolbar and no horizontal overflow.

**Page content / typography / CSS / font / PDF-affecting changes:** the committed `pythagoras-workbook.pdf` must be rebuilt from the real sources with `npm run pdf:build` in an environment where the required browser exists. Re-run `npm run validate`; check provenance, exactly 53 A4 pages, preserved Hebrew text and the generated PDF visually. Do not hand-edit `pdf-provenance.json` or commit a stale PDF. Avoid costly PDF rebuilding on a documentation-only change.

Always prefer a few focused tests first, then broader CI only if impacted. Do not add redundant libraries, parallel validators or speculative dependency upgrades.

## 3. Durable checkpoint and handoff

At each meaningful stopping point record **verified**: repository + branch + `HEAD` commit SHA, clean/dirty worktree, files changed, commands actually run with PASS/FAIL, untested items, current blocker, and the next *one* useful step. Use the existing PR/issue and existing progress record, not an additional source of truth. If blocked by authorization, unavailable Chrome, a lock, CI, or a remote repository, report the exact blocker and stop spending tokens on retries.

Never force-push, delete valuable files, merge, modify `main`, publish to `gh-pages` or deploy without the owner's explicit separate authorization. Do not claim "100% complete" without verified tests and production parity.
