# Tasks

Navigation IDs `tasks` (filters `status`, `kind`) and `tasks/{id}`. Source: `src/app/pages/tasks/TasksPage.tsx`, `TaskDrawer.tsx`, `taskFormat.tsx`.

Snapshots, restores, estimates, maintenance and repository opening all run as server tasks. This screen lists them and shows one in detail with its live log.

## List

Header: title “Tasks”, description “Snapshots, restores and maintenance running on the server.” Actions (right):

- **Kind filter** (dropdown, 150 px, placeholder “All kinds”, accessible name “Kind”, clearable). Shown only when the list has more than one kind. Options: the distinct `kind` values, sorted.
- **Status filter** (segmented): “All”, “Running” or “Running ({n})”, “Failed” or “Failed ({n})”. `n` counts running (`isRunning`: RUNNING or CANCELING) and FAILED tasks in the whole list.

Both filters are part of the navigation state, so the header's running badge can open `tasks?status=running`. Changing a filter replaces the current navigation entry (no extra Back step).

Data: `GET tasks`, polled every 3 s. Sort (`filterTasks`): running first, then newest start time.

Table (min width 640 px; rows clickable → `tasks/{id}` keeping the filters):

| Column          | Content                                                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status (130 px) | Status badge (below)                                                                                                                                                                                              |
| Task            | Kind (medium weight), description below (dimmed, wraps anywhere). While running: an indeterminate striped progress bar (max 260 px) and `progressInfo` if any. If FAILED: `errorMessage` in red, at most 2 lines. |
| Started         | `relativeTime(startTime)`, absolute as tooltip                                                                                                                                                                    |
| Duration (mono) | `formatDuration(startTime, endTime or now)`                                                                                                                                                                       |
| (50 px)         | For `RUNNING` only: red icon button “Cancel task” (`IconX`) → `POST tasks/{id}/cancel`, then refetch. Clicking it doesn't open the row. Failure → red toast “Could not cancel task”.                              |

**Status badge** (`TaskStatusBadge`):

| Status        | Label          | Color  | Icon          |
| ------------- | -------------- | ------ | ------------- |
| RUNNING       | Running        | blue   | small spinner |
| CANCELING     | Canceling      | yellow | small spinner |
| SUCCESS       | Success        | green  | check         |
| FAILED        | Failed         | red    | x             |
| CANCELED      | Canceled       | gray   | ban           |
| anything else | the raw status | gray   | none          |

States: spinner while loading; red alert “Could not load tasks”; empty row “No tasks yet.” or “No tasks match the filter.”

## Task drawer

Drawer over the list. Title “{kind} · task {id}”, or “Task” while loading. Closing returns to `tasks` with the same filters. Data: `GET tasks/{id}` every 0.5 s until `endTime` is set.

Content:

1. Row: status badge, then dimmed “{absolute start} · {duration}”. On the right, for RUNNING: red light button “Cancel task” (`IconX`) → `POST tasks/{id}/cancel`. Failure → red toast “Could not cancel task”.
2. Description (wraps anywhere).
3. While running: `progressInfo` (dimmed), if any.
4. FAILED with a message: red alert “Task failed” with `errorMessage`.
5. **Counters** (only if any are non-zero): borderless two-column table from `counterRows`: label (red for level error, orange for warning), value right-aligned in monospace (bytes formatted, other numbers with separators). Order: error, warning, notice, then the rest; alphabetical within a level.
6. **Log** section.

States: spinner while loading; red alert “Could not load task” if it fails.

### Log

- Title “Log”. While the task runs, a switch “Follow” (on by default). When on, the view scrolls to the newest line whenever lines arrive.
- Data: `GET tasks/{id}/logs`, every 3 s while the task runs, once after.
- Monospace 12 px, tinted background, wraps anywhere, max height half the window (scrolls).
- Each line: time `HH:MM:SS.mmm` (local time, 60 % opacity, full date-time as tooltip), the message, then any extra fields as compact JSON (60 % opacity) (`logParams`).
- Colors by `level` (`logLevelColor`): 3 red, 2 orange, others default. Bold for `level >= 1` in the web UI; native bolds only `level >= 2` (divergence D2).
- Empty: “No log entries.” Loading: spinner. Failure: red alert with the message.
