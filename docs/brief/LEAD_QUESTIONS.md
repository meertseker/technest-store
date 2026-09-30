# Lead questions

Open questions for the owner/lead. Each entry has the default that was chosen so work could continue.
Format: `Q<n> (<area>, <date>)`: question. **Default:** what we did.

## Cloud session 2026-09-30

- Q1 (process): `docs/brief/` (the four `E*_PROMPT.md` briefs and `TEAM_CHAT.md`) is not in the repository
  or on any branch, so the cloud session could not read it. **Default:** worked from `CLAUDE.md`,
  `docs/specs/design.md`, `docs/contracts/*`, ADRs, plans and branch history. Please commit the briefs
  under `docs/brief/` if later sessions should follow them word for word.
- Q2 (process): the cloud session may only push to `claude/peaceful-thompson-0ooaf0`. **Default:** all
  work was merged `--ff-only` into a local `main` and that exact history was pushed to
  `claude/peaceful-thompson-0ooaf0`. To publish it: `git push origin origin/claude/peaceful-thompson-0ooaf0:main`
  (a fast-forward of `main`).
- Q3 (tooling): the Medusa skills (`building-with-medusa`, ...) and `ui-ux-pro-max` are not installed in
  the cloud container. **Default:** used docs.medusajs.com and the installed `@medusajs/*` 2.21.2 source.
