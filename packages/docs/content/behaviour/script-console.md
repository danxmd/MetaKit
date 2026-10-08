---
id: script-console
title: Script console
category: behaviour
summary: The log where scripts print text and where their errors show up, in Build mode and in Model mode.
keywords: [script console, console.log, problems only, script errors, script output, console lines]
contexts: []
order: 80
---

The console is a list of lines. A script writes to it with `console.log`. MetaKit writes to it when a script fails. It is the first place to look when a script does nothing, or something unexpected.

## What it is

Each line has a time, an origin and the text. The origin is the name of the script and, for errors, the line number in the script, such as `Check pipeline, line 14`. Lines about the whole engine have no origin.

| Level | How it appears | Written by |
| --- | --- | --- |
| log | Plain text | `console.log(...)` and `console.debug(...)` |
| info | Plain text | `console.info(...)` |
| warn | Yellow background | `console.warn(...)`, and some engine warnings |
| error | Red background | `console.error(...)` and every script error |

Strings are shown as they are. Objects and lists are shown as JSON. An error object shows its message. Several values are joined with a space.

## Where to find it

- **Model mode:** the toolbar button **Script console** appears as soon as a script has written something. Press it to open or close the console under the canvas. This is where you read script output today.
- **Build mode:** the **Scripts** section has the same console below the editor (see [[scripts]]). It shows the lines of running scripts. Scripts run only while a model is open, so in Build mode, where no model is open, it says "Nothing yet."


The console keeps the last 500 lines of the open model. It starts empty each time a model is opened.

## How to use it

1. Add `console.log("here", someValue);` to a script and save.
2. Run the command or cause the event.
3. Open the console and read the new line.
4. Tick **Problems only** to hide everything but warnings and errors.
5. Press **Clear** to empty the list. The button is off while the list is empty.

An empty console says: "Nothing yet. What scripts print with console.log and the errors they cause show up here."

## Every option explained

| Control | What it does |
| --- | --- |
| **Problems only** | Shows only warnings and errors. |
| **Clear** | Removes all lines. |
| Time | The local time of the line, as hours, minutes and seconds. |
| Origin | The script name, plus `, line N` when MetaKit knows the line. |
| Line text | A line longer than 10,000 characters is cut, with a note of how many characters were left out. |

### What gets written for you

| Situation | Line |
| --- | --- |
| A script has a syntax error | `Unexpected token (line 3, column 5)` style text, with the script name and line. The script goes to the Error state. |
| A script throws | The error message, with the line from the stack. |
| A time limit | `The script took longer than 100 ms and was stopped.` (5 s for a command or a load.) |
| A memory limit | `The script used more memory than it is allowed and was stopped.` |
| Endless recursion | `The script called itself too many times and was stopped.` |
| A run that never ends | `The script did not finish within 60 seconds. It may still be waiting for a file or a web service.` |
| `on()` in a throw-away run | `on("x") was ignored: this run only runs the script once.` |
| Missing permission | The messages from [[script-permissions]]. |

An error is also shown as a message in Model mode. The same message is shown only once within two seconds, so a loop of failures does not flood the screen.

## Examples

```ts
import { on } from "metakit";

on("object.moved", { class: "Task" }, (event) => {
  console.log("moved", event.target, event.old, "to", event.new);
});
```

Move a task and the console shows `moved el_abc... {"x":40,"y":40} to {"x":80,"y":40}`.

## Good to know

- **Line numbers match your source.** The compiler only removes types, so the line in the console is the line in the editor. See [[script-editor]].
- **After an `await`.** Lines written after waiting for a file or a web call still carry the script name.
- **Not saved.** The console lives in memory. Closing the model clears it. Other people do not see your console.
- **Do not log secrets.** Anyone who looks over your shoulder, or a screenshot, can see the console.
- **Rules do not use the console.** Rule problems appear as warning messages. See [[rules]].
- **Trouble.** For common errors and fixes see [[troubleshooting]].

## Related

[[scripts]] · [[script-api]] · [[script-editor]] · [[script-permissions]] · [[behaviour-commands]] · [[problems-panel]]
