# Design tokens

Source: `src/app/theme.ts` and Mantine 9 defaults (`node_modules/@mantine/core/esm/core/MantineProvider/default-*.mjs`).

The goal is **the same meaning, not the same pixels**. Native clients use their platform's controls, typography and spacing (Fluent on Windows, AppKit/SwiftUI on macOS). They keep the brand color, the semantic color roles below, the icon meanings and the text.

## Brand

- Logo: `public/kopia-flat.svg`, shown at 36 × 25 px in the header.
- Primary color “kopia” blue, `#2a7fff` (logo blue). Light mode uses shade 6, dark mode shade 7 (calmer filled buttons).

| Shade | 0       | 1       | 2       | 3       | 4       | 5       | **6**       | **7**       | 8       | 9       |
| ----- | ------- | ------- | ------- | ------- | ------- | ------- | ----------- | ----------- | ------- | ------- |
| kopia | #eef5ff | #d9e8ff | #b4d2ff | #90bcff | #6aa5ff | #4891ff | **#2a7fff** | **#2570e0** | #205fbf | #1a4f9e |

Native: set it as the app accent color (WinUI `SystemAccentColor` overrides for the app, SwiftUI `.tint`), so buttons, selection and toggles use it.

## Semantic color roles

The UI uses named Mantine palettes. Shade 6 is the filled color; “light” variants are a ~10 % tint background with shade-6-ish text.

| Role                       | Palette | Shade 6 | Used for                                                                                                    |
| -------------------------- | ------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| Primary / action           | kopia   | #2a7fff | primary buttons, links, selected nav item, folder icons                                                     |
| Success / protected        | green   | #40c057 | “Protected”, “Success”, “Connected”, success toasts, “all good”                                             |
| In progress                | blue    | #228be6 | “Uploading”, “Running”, progress bars, info alerts, restore-started toast                                   |
| Warning / overdue          | yellow  | #fab005 | “Overdue”, “Canceling”, “incomplete”, “Read-only”, “Showing last known state”, policy preview warnings      |
| Attention / errors in data | orange  | #fd7e14 | error-count badges, pins, warning counters, warning log lines, “Needs attention” card, severities ≥ Warning |
| Failure / destructive      | red     | #fa5252 | “Failed”, error alerts and toasts, Delete/Stop/Disconnect buttons, error counters and log lines             |
| Neutral                    | gray    | #868e96 | “Pending”, “Paused”, “Never backed up”, “Canceled”, “Not connected”                                         |
| Data                       | cyan    | #15aabf | “Protected data” card icon, hourly retention                                                                |

Retention-reason badges: latest teal `#12b886`, hourly cyan `#15aabf`, daily blue `#228be6`, weekly indigo `#4c6ef5`, monthly grape `#be4bdb`, other pink `#e64980`.

Policy kinds: Global teal, Computer blue, User indigo, Folder grape.

Folder icons in the snapshot browser: yellow `#fab005`.

Full Mantine palettes (shade 0 → 9):

| Palette | Shades                                                                          |
| ------- | ------------------------------------------------------------------------------- |
| gray    | #f8f9fa #f1f3f5 #e9ecef #dee2e6 #ced4da #adb5bd #868e96 #495057 #343a40 #212529 |
| dark    | #C9C9C9 #b8b8b8 #828282 #696969 #424242 #3b3b3b #2e2e2e #242424 #1f1f1f #141414 |
| red     | #fff5f5 #ffe3e3 #ffc9c9 #ffa8a8 #ff8787 #ff6b6b #fa5252 #f03e3e #e03131 #c92a2a |
| pink    | #fff0f6 #ffdeeb #fcc2d7 #faa2c1 #f783ac #f06595 #e64980 #d6336c #c2255c #a61e4d |
| grape   | #f8f0fc #f3d9fa #eebefa #e599f7 #da77f2 #cc5de8 #be4bdb #ae3ec9 #9c36b5 #862e9c |
| indigo  | #edf2ff #dbe4ff #bac8ff #91a7ff #748ffc #5c7cfa #4c6ef5 #4263eb #3b5bdb #364fc7 |
| blue    | #e7f5ff #d0ebff #a5d8ff #74c0fc #4dabf7 #339af0 #228be6 #1c7ed6 #1971c2 #1864ab |
| cyan    | #e3fafc #c5f6fa #99e9f2 #66d9e8 #3bc9db #22b8cf #15aabf #1098ad #0c8599 #0b7285 |
| teal    | #e6fcf5 #c3fae8 #96f2d7 #63e6be #38d9a9 #20c997 #12b886 #0ca678 #099268 #087f5b |
| green   | #ebfbee #d3f9d8 #b2f2bb #8ce99a #69db7c #51cf66 #40c057 #37b24d #2f9e44 #2b8a3e |
| yellow  | #fff9db #fff3bf #ffec99 #ffe066 #ffd43b #fcc419 #fab005 #f59f00 #f08c00 #e67700 |
| orange  | #fff4e6 #ffe8cc #ffd8a8 #ffc078 #ffa94d #ff922b #fd7e14 #f76707 #e8590c #d9480f |

Native: map roles to system semantic colors where they exist (Windows `SystemFillColorSuccess` / `Caution` / `Critical`, macOS `.systemGreen` / `.systemYellow` / `.systemRed`), and use the hex values only for roles without a system equivalent (retention and kind badges). Check contrast in both light and dark mode.

## Color scheme

“Auto” (follow the OS), “Light” or “Dark”, chosen in Preferences or with the header toggle. Default Auto.

## Typography

- Font: the theme asks for “Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif”, but **Inter is not loaded**, so the web UI renders in the system font (Segoe UI on Windows, San Francisco on macOS). Native clients use the system font.
- Headings weight 650. Page titles are level-2 headings.
- Sizes: xs 12, sm 14, md 16, lg 18, xl 20 px. Body text in tables and forms is mostly sm (14). Hints and secondary lines xs (12), dimmed.
- Stat-card values 20 px (narrow) / 26 px, bold. Stat-card labels xs, uppercase, semibold, dimmed.
- Monospace for sizes, file counts, durations, IDs, paths in detail tables, logs, JSON and CLI lines.

Native mapping: page title → WinUI `TitleTextBlockStyle` / SwiftUI `.title2`; card title → `SubtitleTextBlockStyle` / `.headline`; body → `BodyTextBlockStyle` / `.body`; hints → `CaptionTextBlockStyle` / `.caption` secondary.

## Spacing, radius, breakpoints

| Token           | xs  | sm  | md              | lg  | xl  |
| --------------- | --- | --- | --------------- | --- | --- |
| spacing (px)    | 10  | 12  | 16              | 20  | 32  |
| radius (px)     | 2   | 4   | **8** (default) | 16  | 32  |
| breakpoint (em) | 36  | 48  | 62              | 75  | 88  |

Header height 60 px, sidebar 240 px, page padding lg (20 px). Cards have a border and lg padding by default. Tables use sm vertical spacing and highlight rows on hover.

## Controls

Suggested native counterparts, by role. Pick the closest platform control; these are not verified one-to-one matches.

| Web (Mantine)                              | Windows (WinUI 3)                                            | macOS (SwiftUI)                                                  |
| ------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Button (filled / light / default / subtle) | `Button` with `AccentButtonStyle` / default / `SubtleButton` | `Button` with `.borderedProminent` / `.bordered` / `.borderless` |
| ActionIcon with tooltip                    | icon `Button` + `ToolTipService.ToolTip`                     | icon `Button` + `.help()`                                        |
| SegmentedControl                           | `SelectorBar` or `RadioButtons`                              | `Picker(.segmented)`                                             |
| Select                                     | `ComboBox`                                                   | `Picker(.menu)`                                                  |
| Autocomplete (path field)                  | `AutoSuggestBox` + Browse button                             | `TextField` + suggestions menu + Browse                          |
| TagsInput                                  | `TokenizingTextBox` (Community Toolkit) or chips + `TextBox` | token field (`NSTokenField`) or chips                            |
| Switch                                     | `ToggleSwitch`                                               | `Toggle`                                                         |
| Badge                                      | `InfoBadge` / bordered text pill                             | capsule `Text`                                                   |
| Card                                       | `Border` with `CardBackgroundFillColorDefault`               | `GroupBox` / rounded background                                  |
| Table                                      | `ListView` with column header (or `DataGrid`)                | `Table`                                                          |
| Drawer                                     | split-view detail pane or `ContentDialog`-sized flyout       | `.inspector` or trailing pane                                    |
| Modal                                      | `ContentDialog`                                              | `.sheet` / `.alert`                                              |
| Toast                                      | `InfoBar` (in-app)                                           | overlay banner                                                   |
| Stepper                                    | `BreadcrumbBar` + paged content                              | segmented header + paged content                                 |
| Accordion                                  | `Expander`                                                   | `DisclosureGroup`                                                |
| Progress (determinate / striped)           | `ProgressBar` / `IsIndeterminate`                            | `ProgressView(value:)` / indeterminate                           |
| Loader                                     | `ProgressRing`                                               | `ProgressView()`                                                 |

## Icons

The web UI uses Tabler icons. Native suggestions below are **suggestions** (closest glyph by meaning), not verified one-to-one matches.

| Tabler                                                              | Meaning                                                   | Windows (Segoe Fluent Icons)                  | macOS (SF Symbols)                                                          |
| ------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| IconArchive                                                         | Snapshots                                                 | Archive                                       | archivebox                                                                  |
| IconShieldCheck                                                     | Policies / policy                                         | Shield                                        | checkmark.shield                                                            |
| IconListCheck                                                       | Tasks                                                     | TaskView / BulletedList                       | checklist                                                                   |
| IconDatabase                                                        | Repository                                                | Database / HardDrive                          | cylinder                                                                    |
| IconDatabaseOff                                                     | Not connected                                             | — (Database + slash)                          | cylinder.split.1x2                                                          |
| IconSettings                                                        | Preferences                                               | Settings                                      | gearshape                                                                   |
| IconFolder / IconFolderOpen                                         | folder / browse / mount                                   | Folder / OpenFolderHorizontal                 | folder / folder.badge.gearshape                                             |
| IconFile                                                            | file                                                      | Page                                          | doc                                                                         |
| IconPlus                                                            | new / add                                                 | Add                                           | plus                                                                        |
| IconRefresh                                                         | synchronize                                               | Sync                                          | arrow.clockwise                                                             |
| IconPlayerPlay                                                      | snapshot now                                              | Play                                          | play.fill                                                                   |
| IconPlayerStop                                                      | stop snapshot                                             | Stop                                          | stop.fill                                                                   |
| IconDots                                                            | more actions                                              | More                                          | ellipsis                                                                    |
| IconHistory                                                         | history / retention                                       | History                                       | clock.arrow.circlepath                                                      |
| IconListDetails                                                     | task details                                              | List                                          | list.bullet.rectangle                                                       |
| IconRestore                                                         | restore                                                   | Undo / Restore                                | arrow.uturn.backward                                                        |
| IconDownload                                                        | download                                                  | Download                                      | arrow.down.circle                                                           |
| IconTrash                                                           | delete / forget                                           | Delete                                        | trash                                                                       |
| IconPin / IconPinnedOff                                             | pin / unpin                                               | Pin / Unpin                                   | pin / pin.slash                                                             |
| IconPencil                                                          | edit                                                      | Edit                                          | pencil                                                                      |
| IconAlertTriangle                                                   | warning / errors                                          | Warning                                       | exclamationmark.triangle                                                    |
| IconCheck                                                           | success / current                                         | CheckMark                                     | checkmark                                                                   |
| IconX                                                               | failed / cancel                                           | Cancel                                        | xmark                                                                       |
| IconBan                                                             | canceled                                                  | Blocked                                       | nosign                                                                      |
| IconClockPlay                                                       | next snapshot                                             | Clock                                         | clock.badge                                                                 |
| IconCalculator                                                      | estimate                                                  | Calculator                                    | function                                                                    |
| IconSearch                                                          | filter                                                    | Search                                        | magnifyingglass                                                             |
| IconSelector                                                        | repository switcher                                       | ChevronDown                                   | chevron.up.chevron.down                                                     |
| IconPlugConnectedX                                                  | disconnect                                                | Disconnect                                    | bolt.horizontal.slash                                                       |
| IconTerminal2                                                       | CLI equivalent / actions tab                              | CommandPrompt                                 | terminal                                                                    |
| IconCopy                                                            | copy                                                      | Copy                                          | doc.on.doc                                                                  |
| IconExternalLink                                                    | open externally                                           | OpenInNewWindow                               | arrow.up.right.square                                                       |
| IconMail / IconBell / IconWebhook                                   | e-mail / Pushover / webhook                               | Mail / Ringer / Link                          | envelope / bell / link                                                      |
| IconSend                                                            | send test                                                 | Send                                          | paperplane                                                                  |
| IconCalendarTime, IconFilter, IconFileZip, IconUpload, IconFileText | policy tabs Schedule, Files, Compression, Upload, Logging | Calendar, Filter, ZipFolder, Upload, Document | calendar, line.3.horizontal.decrease, doc.zipper, arrow.up.circle, doc.text |
| IconSun / IconMoon                                                  | color scheme toggle                                       | Brightness / QuietHours                       | sun.max / moon                                                              |
