# usage-guard

A Claude Code plugin that pauses tool use once your weekly Claude plan usage
reaches a cap, so an agent can't burn through the last of your week's limit
on its own. Below the cap nothing changes; at or above it every tool call is
refused with a message saying the usage, the cap and when the week resets.

The usage figure is the `seven_day` rate-limit window Claude Code itself
reports (the same one the status line shows). With no reading yet, or once the
window has reset, the guard lets everything through.

## Commands

| Command | Effect |
|---|---|
| `/usage-cap` | Show the cap, on/off state and current weekly usage |
| `/usage-cap 95` | Set the cap to 95 % (any 1-100) and turn the guard on |
| `/usage-cap off` | Turn the guard off |
| `/usage-cap on` | Turn it back on |
| `/usage-cap reset` | Back to the default cap (84 %) and on |
| `/usage-cap exempt` | Never block this project (its root and everything under it), whatever the cap |
| `/usage-cap unexempt` | Remove this project's exemption |

Slash commands are not tool calls, so `/usage-cap` works even while the guard
is blocking. Settings are kept in the plugin's own store: they apply on the
next tool call, survive restarts, and are shared by every session on the
machine.

## Install

```
/plugin install usage-guard --marketplace Aethryl/claude-usage-guard
```

Answer `y` to add the marketplace, then pick the user scope. The repository is
private: installing needs read access to it and a git credential for
github.com on the machine (an SSH key, or `gh auth login` then
`gh auth setup-git`).

## Develop

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```
