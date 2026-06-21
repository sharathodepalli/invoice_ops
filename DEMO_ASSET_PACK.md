# Demo Asset Pack

Use this invoice mix for rehearsal and recording so the walkthrough stays consistent.

## Suggested Sample Set

| #   | Scenario                   | Target Status | Why it matters                                |
| --- | -------------------------- | ------------- | --------------------------------------------- |
| 1   | Clean invoice              | Approved      | Shows the happy path with no review friction  |
| 2   | Total mismatch             | Exception     | Demonstrates validation catching math errors  |
| 3   | Missing PO number          | Exception     | Shows a common AP control gap                 |
| 4   | Low confidence vendor name | Exception     | Demonstrates confidence-based review          |
| 5   | Duplicate candidate        | Exception     | Shows duplicate detection behavior            |
| 6   | Edited and approved        | Approved      | Demonstrates field correction and audit trail |
| 7   | Rejected invoice           | Rejected      | Shows decision handling                       |
| 8   | Currency mismatch          | Exception     | Demonstrates a field-level issue              |
| 9   | Missing invoice date       | Exception     | Demonstrates required field validation        |
| 10  | Clean exportable invoice   | Approved      | Gives export selection variety                |

## File Preparation Notes

- Keep file names simple and descriptive.
- Include at least one scanned PDF if possible, not just text PDFs.
- Ensure each invoice has a unique vendor or invoice number where needed.
- For the exception examples, make sure at least one invoice clearly violates total math or missing PO rules.

## Rehearsal Goal

The rehearsal should exercise:

- upload
- extraction and validation
- exceptions filtering
- invoice edit and approval
- export download and history

If a file does not trigger the expected status, swap it for another sample before recording.
