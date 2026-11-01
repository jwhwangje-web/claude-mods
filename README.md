# claude-mods

Two small mods for Claude.

- **usage-band**: a band above the prompt that always shows your remaining usage (5-hour and weekly windows, with reset times), plus disk and memory of the machine the session runs on. `/usage-band` hides or shows it.
- **memo-pad**: `/memo` (or the ✎ button above the prompt) opens a memo pad in a side pane. Saved memos appear as buttons above the prompt; pressing one puts the memo into the prompt box. Memos are kept across sessions.

## Install

At the prompt of a terminal session:

```
/plugin install usage-band --marketplace jwhwangje-web/claude-mods
/plugin install memo-pad --marketplace jwhwangje-web/claude-mods
```

Answer `y` to add the marketplace, then pick a scope (user scope is first; press Enter).

From a shell:

```
claude plugin install usage-band --marketplace jwhwangje-web/claude-mods
claude plugin install memo-pad --marketplace jwhwangje-web/claude-mods
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `jwhwangje-web/claude-mods`, then **Add plugin**.

If this repository is private, it installs only for people who can read it on GitHub and whose machine already holds a git credential for github.com (an SSH key, or `gh auth login` then `gh auth setup-git`).
