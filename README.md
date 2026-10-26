<div align="center">

<img alt="usage-guard: a gauge with its needle pinned at the cap" src="assets/usage-guard.svg" width="240">

# usage-guard

**A weekly usage cap for Claude Code.**
Stops your agents from spending the rest of the week's Claude plan while you're not watching.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude_Code-plugin-d97757.svg)](https://docs.claude.com/en/docs/claude-code)
[![Version](https://img.shields.io/badge/version-0.2.0-green.svg)](.claude-plugin/plugin.json)

</div>

---

You leave three agents running overnight. In the morning the week's limit is gone and it's only
Tuesday. **usage-guard** puts a ceiling on that: once your weekly plan usage reaches the cap you set,
every tool call is refused with a clear message, so sessions stall instead of burning the rest
of the week.

```
● Bash(cargo build)
  ⎿  Weekly Claude usage is at 85% (cap 84%). Tool use is paused until the weekly limit
     resets (Mon 02 Nov, 13:00). Raise the cap with /usage-cap <percent>, or turn the
     guard off with /usage-cap off.
```

## Features

- **One number to set.** Pick a percentage of your weekly limit; below it nothing changes.
- **Works while it's blocking.** `/usage-cap` is a slash command, not a tool call, so you can raise
  the cap or switch it off from a blocked session without restarting.
- **Per-project exemptions.** Keep one project usable no matter what — say, the repo you use to fix
  things when everything else is stuck.
- **Same numbers as Claude Code.** It reads the `seven_day` rate-limit window Claude Code itself
  reports, the one the status line shows. No API keys, no scraping.
- **Fails open.** No reading yet, the window already reset, or the guard itself errors: your tool
  call goes through. It never blocks you by accident.
- **Machine-wide.** Settings live in the plugin's store, survive restarts and apply to every session
  on the machine from the next tool call.

## Install

At the prompt of a Claude Code session:

```
/plugin install usage-guard --marketplace Aethryl/claude-usage-guard
```

Answer `y` to add the marketplace and pick the **user** scope. The default cap is **84 %**, active
right away.

## Usage

| Command | What it does |
|---|---|
| `/usage-cap` | Show the cap, on/off, current weekly usage and exempt projects |
| `/usage-cap 95` | Set the cap to 95 % (any 1–100) and turn the guard on |
| `/usage-cap off` | Turn the guard off |
| `/usage-cap on` | Turn it back on |
| `/usage-cap reset` | Back to the default cap (84 %) and on |
| `/usage-cap exempt` | Never block the current project (its root and everything under it) |
| `/usage-cap unexempt` | Remove the current project's exemption |

```
> /usage-cap
usage-guard on: cap 84%, weekly usage 61%, resets Mon 02 Nov, 13:00; this project is not exempt.
```

## How it works

```
tool call ──▶ guard on? ──no──▶ run
                 │yes
                 ▼
          project exempt? ──yes──▶ run
                 │no
                 ▼
          weekly usage ≥ cap? ──no──▶ run
                 │yes
                 ▼
          refuse, with the usage, the cap and the reset time
```

The plugin is a single hooks module ([`hooks/register.ts`](hooks/register.ts), about 100 lines) on
Claude Code's `tool.call` event. Its only state is the cap, the on/off switch and the exempt list,
kept in the plugin's own store.

## FAQ

**Does it count tokens or call any API?**
No. It asks Claude Code for the usage figure it already has.

**What about the 5-hour window?**
Out of scope. Claude Code already stops at that limit, and it resets within hours. The weekly one
is the one that hurts.

**Does `--dangerously-skip-permissions` bypass it?**
No. That flag skips permission prompts, not plugin hooks. Use `/usage-cap off` instead.

**Can I set different caps per project?**
Not yet: there is one cap per machine, plus the exempt list.

## Develop

```bash
claude plugin validate .   # manifest and module checks
claude plugin test .       # run the test suite
claude --plugin-dir .      # try it in a session without installing
```

Built and tested on Claude Code 2.1.310. Issues and PRs welcome.

## License

[MIT](LICENSE)
