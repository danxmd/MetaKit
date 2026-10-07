# ADR 0001: hybrid logical clock format

Status: accepted (phase 1). Decided by the phase 0 gate report, which asked for the format to be fixed with the file formats, because change files and snapshots carry it.

## Context

Every edit is stamped with a hybrid logical clock so that all instances pick the same winner per field, whatever order files arrive in (architecture rule 7). The phase 0 sync spike used `<ISO time>/<4 digits>`. Two questions were open: the width of the counter, and what happens when it runs out. A single import of a 5,000 element model with ten fields each is 50,000 edits in about the same millisecond, so 4 digits (9,999) is too few.

## Decision

A timestamp is text: `<UTC time in ISO 8601 with milliseconds and a Z>/<six decimal digits>`, for example `2026-10-07T09:14:03.512Z/000042`.

- Plain string comparison orders timestamps correctly. Ties are broken by the instance id, compared as text.
- Sending a local edit: if the wall clock is later than the clock's time, use it and reset the counter to 0; otherwise keep the time and add one to the counter. If the counter would pass 999999, advance the time by one millisecond and reset the counter to 0. Values therefore only ever increase.
- Receiving a timestamp: if it is later than the clock's own, adopt it.
- Exactly this shape is required. Anything else is not a timestamp and is rejected when read.

## Consequences

- 999,999 edits per millisecond are possible before the clock runs ahead of the wall clock by one millisecond; the overflow rule keeps ordering correct beyond that, at the cost of a slightly future time.
- Timestamps are 27 characters. A change line carries one, which is acceptable next to the field and value.
- Years after 9999 and before 0000 cannot be written; not a practical limit.

## Alternatives considered

- Four digits, as in the spike: too few for imports.
- A numeric pair `[milliseconds, counter]`: harder to read in files and to compare in tools; text sorts by itself.
- A pure Lamport counter: loses the wall-clock hint that makes "later edit wins" match what people expect.
