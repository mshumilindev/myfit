# Program editor page: Coach vs athlete pixel diff

Reproduce: `npx storybook build -o ../_shots/iter13/sb` (in `client`), then
`python3 scripts/page-pair-shoot.py <sb dir> <shots dir>` and `python3 scripts/page-pair-diff.py <shots dir> report.md`.
The stories are `Tools/Program editor page` (`HostPair`): the SAME fixture document rendered by the Coach host (`.app-coach`
accent ramp, `AssignmentCard` band, Check / Save draft / Send) and by the athlete host (default accent ramp, `AthleteBandBody`
band, Save draft / Activate), 7 states x 3 widths (1440, 768, 390).

## Method

Both shots are cropped per LANDMARK (back pill, title block, band head, toolbar, training-days label, day strip, first day tile,
day card head, mode tabs, inspector head ...) by the landmark's own rectangle, because the functional slots (band rows, week
setup, action buttons, inspector pane) have different heights and push everything below. Normalisation of the accent: both
crops go to luma, are auto-contrasted, reduced to EDGES (FIND_EDGES, threshold) and dilated by 2 px, so a brass and a tourmaline
fill compare by geometry (borders, glyph outlines), not by hue or lightness. Pixels inside functional slots (`day-tags`,
`daycard-title`, `daycard-tag`, `daycard-foot`, `inspector-body`) are masked. Landmarks whose content is host text (back pill,
title block, band head, whole day card, inspector, cluster, band, bar, foot) are SIZE ONLY: the left edge must match, the
width must match when the box is not content-sized. A landmark fails when its left edge differs by more than 1 px, its width by
more than 1 px (title and cluster excepted: they hold host text), its height by more than 1 px (excepted: boxes holding a
functional slot), or more than 4 % of its unmasked edge pixels differ (15 % for the accent-filled day tile and mode tabs, whose
fill contrast differs per ramp).

## Result

0 landmarks differ outside the functional slots: 220 compared landmarks pass, 113 are size-only, 32 are absent in both hosts
(for example the inspector in the states without a selection). Not a literal 0 px diff: see the "Not 100%" section in
`docs/PROGRAM-EDITOR-TOOL.md` section 7 and the iteration notes.

## Table

| state-width   | landmark       | result         | size delta (w x h) | left delta | differing px |
| ------------- | -------------- | -------------- | ------------------ | ---------- | ------------ |
| activity-1440 | back           | ok             | 0x0                | 0          | size only    |
| activity-1440 | title          | ok             | 169x0              | 0          | size only    |
| activity-1440 | band-head      | ok             | 0x0                | 0          | size only    |
| activity-1440 | toolbar        | ok             | 0x0                | 0          | 0.00%        |
| activity-1440 | days-label     | ok             | 0x0                | 0          | 1.16%        |
| activity-1440 | days           | ok             | 0x14               | 0          | 4.65%        |
| activity-1440 | day-first      | ok             | 0x14               | 0          | 4.23%        |
| activity-1440 | daycard-modes  | ok             | 0x0                | 0          | 0.04%        |
| activity-1440 | daycard-head   | ok             | 0x28               | 0          | size only    |
| activity-1440 | daycard        | ok             | 0x28               | 0          | size only    |
| activity-1440 | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| activity-1440 | inspector      | ok             | 0x0                | 0          | size only    |
| activity-768  | back           | ok             | 0x0                | 0          | size only    |
| activity-768  | title          | ok             | 362x0              | 0          | size only    |
| activity-768  | band-head      | ok             | 0x0                | 0          | size only    |
| activity-768  | toolbar        | ok             | 0x0                | 0          | 0.00%        |
| activity-768  | days-label     | ok             | 0x0                | 0          | 0.00%        |
| activity-768  | days           | ok             | 0x14               | 0          | 6.30%        |
| activity-768  | day-first      | ok             | 0x14               | 0          | 6.28%        |
| activity-768  | daycard-modes  | ok             | 0x0                | 0          | 0.09%        |
| activity-768  | daycard-head   | ok             | 0x28               | 0          | size only    |
| activity-768  | daycard        | ok             | 0x16               | 0          | size only    |
| activity-768  | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| activity-768  | inspector      | ok             | 0x0                | 0          | size only    |
| activity-390  | back           | ok             | 0x0                | 0          | size only    |
| activity-390  | title          | ok             | 54x20              | 0          | size only    |
| activity-390  | band-head      | ok             | 0x0                | 0          | size only    |
| activity-390  | toolbar        | ok             | 0x0                | 0          | 3.00%        |
| activity-390  | days-label     | ok             | 0x0                | 0          | 0.00%        |
| activity-390  | days           | ok             | 0x49               | 0          | 14.03%       |
| activity-390  | day-first      | ok             | 0x31               | 0          | 1.48%        |
| activity-390  | daycard-modes  | ok             | 0x0                | 0          | 0.12%        |
| activity-390  | daycard-head   | ok             | 0x28               | 0          | size only    |
| activity-390  | daycard        | ok             | 0x28               | 0          | size only    |
| activity-390  | inspector-head | absent in both |                    |            |              |
| activity-390  | inspector      | absent in both |                    |            |              |
| empty-1440    | back           | ok             | 0x0                | 0          | size only    |
| empty-1440    | title          | ok             | 169x0              | 0          | size only    |
| empty-1440    | band-head      | ok             | 0x0                | 0          | size only    |
| empty-1440    | toolbar        | ok             | 0x0                | 0          | 0.00%        |
| empty-1440    | days-label     | absent in both |                    |            |              |
| empty-1440    | days           | absent in both |                    |            |              |
| empty-1440    | day-first      | absent in both |                    |            |              |
| empty-1440    | daycard-modes  | absent in both |                    |            |              |
| empty-1440    | daycard-head   | absent in both |                    |            |              |
| empty-1440    | daycard        | absent in both |                    |            |              |
| empty-1440    | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| empty-1440    | inspector      | ok             | 0x0                | 0          | size only    |
| empty-768     | back           | ok             | 0x0                | 0          | size only    |
| empty-768     | title          | ok             | 362x0              | 0          | size only    |
| empty-768     | band-head      | ok             | 0x0                | 0          | size only    |
| empty-768     | toolbar        | ok             | 0x0                | 0          | 0.00%        |
| empty-768     | days-label     | absent in both |                    |            |              |
| empty-768     | days           | absent in both |                    |            |              |
| empty-768     | day-first      | absent in both |                    |            |              |
| empty-768     | daycard-modes  | absent in both |                    |            |              |
| empty-768     | daycard-head   | absent in both |                    |            |              |
| empty-768     | daycard        | absent in both |                    |            |              |
| empty-768     | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| empty-768     | inspector      | ok             | 0x0                | 0          | size only    |
| empty-390     | back           | ok             | 0x0                | 0          | size only    |
| empty-390     | title          | ok             | 54x20              | 0          | size only    |
| empty-390     | band-head      | ok             | 0x0                | 0          | size only    |
| empty-390     | toolbar        | ok             | 0x0                | 0          | 2.75%        |
| empty-390     | days-label     | absent in both |                    |            |              |
| empty-390     | days           | absent in both |                    |            |              |
| empty-390     | day-first      | absent in both |                    |            |              |
| empty-390     | daycard-modes  | absent in both |                    |            |              |
| empty-390     | daycard-head   | absent in both |                    |            |              |
| empty-390     | daycard        | absent in both |                    |            |              |
| empty-390     | inspector-head | absent in both |                    |            |              |
| empty-390     | inspector      | absent in both |                    |            |              |
| findings-1440 | back           | ok             | 0x0                | 0          | size only    |
| findings-1440 | title          | ok             | 177x0              | 0          | size only    |
| findings-1440 | band-head      | ok             | 0x0                | 0          | size only    |
| findings-1440 | toolbar        | ok             | 0x0                | 0          | 0.22%        |
| findings-1440 | days-label     | ok             | 0x0                | 0          | 0.00%        |
| findings-1440 | days           | ok             | 0x18               | 0          | 4.50%        |
| findings-1440 | day-first      | ok             | 0x18               | 0          | 4.44%        |
| findings-1440 | daycard-modes  | ok             | 0x0                | 0          | 7.13%        |
| findings-1440 | daycard-head   | ok             | 0x28               | 0          | size only    |
| findings-1440 | daycard        | ok             | 0x28               | 0          | size only    |
| findings-1440 | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| findings-1440 | inspector      | ok             | 0x378              | 0          | size only    |
| findings-768  | back           | ok             | 0x0                | 0          | size only    |
| findings-768  | title          | ok             | 405x0              | 0          | size only    |
| findings-768  | band-head      | ok             | 0x0                | 0          | size only    |
| findings-768  | toolbar        | ok             | 0x0                | 0          | 1.75%        |
| findings-768  | days-label     | ok             | 0x0                | 0          | 0.00%        |
| findings-768  | days           | ok             | 0x18               | 0          | 4.56%        |
| findings-768  | day-first      | ok             | 0x18               | 0          | 4.65%        |
| findings-768  | daycard-modes  | ok             | 0x0                | 0          | 7.51%        |
| findings-768  | daycard-head   | ok             | 0x28               | 0          | size only    |
| findings-768  | daycard        | ok             | 0x16               | 0          | size only    |
| findings-768  | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| findings-768  | inspector      | ok             | 0x359              | 0          | size only    |
| findings-390  | back           | ok             | 0x0                | 0          | size only    |
| findings-390  | title          | ok             | 54x20              | 0          | size only    |
| findings-390  | band-head      | ok             | 0x0                | 0          | size only    |
| findings-390  | toolbar        | ok             | 0x0                | 0          | 0.00%        |
| findings-390  | days-label     | ok             | 0x0                | 0          | 0.00%        |
| findings-390  | days           | ok             | 0x36               | 0          | 12.13%       |
| findings-390  | day-first      | ok             | 0x18               | 0          | 5.21%        |
| findings-390  | daycard-modes  | ok             | 0x0                | 0          | 0.12%        |
| findings-390  | daycard-head   | ok             | 0x28               | 0          | size only    |
| findings-390  | daycard        | ok             | 0x28               | 0          | size only    |
| findings-390  | inspector-head | absent in both |                    |            |              |
| findings-390  | inspector      | absent in both |                    |            |              |
| muscles-1440  | back           | ok             | 0x0                | 0          | size only    |
| muscles-1440  | title          | ok             | 169x0              | 0          | size only    |
| muscles-1440  | band-head      | ok             | 0x0                | 0          | size only    |
| muscles-1440  | toolbar        | ok             | 0x0                | 0          | 0.00%        |
| muscles-1440  | days-label     | ok             | 0x0                | 0          | 1.16%        |
| muscles-1440  | days           | ok             | 0x18               | 0          | 4.42%        |
| muscles-1440  | day-first      | ok             | 0x18               | 0          | 0.92%        |
| muscles-1440  | daycard-modes  | ok             | 0x0                | 0          | 5.15%        |
| muscles-1440  | daycard-head   | ok             | 0x28               | 0          | size only    |
| muscles-1440  | daycard        | ok             | 0x28               | 0          | size only    |
| muscles-1440  | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| muscles-1440  | inspector      | ok             | 0x0                | 0          | size only    |
| muscles-768   | back           | ok             | 0x0                | 0          | size only    |
| muscles-768   | title          | ok             | 362x0              | 0          | size only    |
| muscles-768   | band-head      | ok             | 0x0                | 0          | size only    |
| muscles-768   | toolbar        | ok             | 0x0                | 0          | 0.00%        |
| muscles-768   | days-label     | ok             | 0x0                | 0          | 0.00%        |
| muscles-768   | days           | ok             | 0x18               | 0          | 6.00%        |
| muscles-768   | day-first      | ok             | 0x18               | 0          | 2.57%        |
| muscles-768   | daycard-modes  | ok             | 0x0                | 0          | 5.24%        |
| muscles-768   | daycard-head   | ok             | 0x28               | 0          | size only    |
| muscles-768   | daycard        | ok             | 0x16               | 0          | size only    |
| muscles-768   | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| muscles-768   | inspector      | ok             | 0x0                | 0          | size only    |
| muscles-390   | back           | ok             | 0x0                | 0          | size only    |
| muscles-390   | title          | ok             | 54x20              | 0          | size only    |
| muscles-390   | band-head      | ok             | 0x0                | 0          | size only    |
| muscles-390   | toolbar        | ok             | 0x0                | 0          | 2.99%        |
| muscles-390   | days-label     | ok             | 0x0                | 0          | 0.00%        |
| muscles-390   | days           | ok             | 0x36               | 0          | 11.96%       |
| muscles-390   | day-first      | ok             | 0x18               | 0          | 1.50%        |
| muscles-390   | daycard-modes  | ok             | 0x0                | 0          | 0.06%        |
| muscles-390   | daycard-head   | ok             | 0x28               | 0          | size only    |
| muscles-390   | daycard        | ok             | 0x28               | 0          | size only    |
| muscles-390   | inspector-head | absent in both |                    |            |              |
| muscles-390   | inspector      | absent in both |                    |            |              |
| readonly-1440 | back           | ok             | 0x0                | 0          | size only    |
| readonly-1440 | title          | ok             | 46x0               | 0          | size only    |
| readonly-1440 | band-head      | ok             | 0x0                | 0          | size only    |
| readonly-1440 | toolbar        | ok             | 0x0                | 0          | 1.28%        |
| readonly-1440 | days-label     | ok             | 0x0                | 0          | 1.16%        |
| readonly-1440 | days           | ok             | 0x18               | 0          | 4.42%        |
| readonly-1440 | day-first      | ok             | 0x18               | 0          | 4.17%        |
| readonly-1440 | daycard-modes  | ok             | 0x0                | 0          | 0.04%        |
| readonly-1440 | daycard-head   | ok             | 0x0                | 0          | size only    |
| readonly-1440 | daycard        | ok             | 0x0                | 0          | size only    |
| readonly-1440 | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| readonly-1440 | inspector      | ok             | 0x378              | 0          | size only    |
| readonly-768  | back           | ok             | 0x0                | 0          | size only    |
| readonly-768  | title          | ok             | 46x0               | 0          | size only    |
| readonly-768  | band-head      | ok             | 0x0                | 0          | size only    |
| readonly-768  | toolbar        | ok             | 0x0                | 0          | 1.49%        |
| readonly-768  | days-label     | ok             | 0x0                | 0          | 0.00%        |
| readonly-768  | days           | ok             | 0x18               | 0          | 6.00%        |
| readonly-768  | day-first      | ok             | 0x18               | 0          | 5.82%        |
| readonly-768  | daycard-modes  | ok             | 0x0                | 0          | 0.09%        |
| readonly-768  | daycard-head   | ok             | 0x0                | 0          | size only    |
| readonly-768  | daycard        | ok             | 0x0                | 0          | size only    |
| readonly-768  | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| readonly-768  | inspector      | ok             | 0x359              | 0          | size only    |
| readonly-390  | back           | ok             | 0x0                | 0          | size only    |
| readonly-390  | title          | ok             | 46x17              | 0          | size only    |
| readonly-390  | band-head      | ok             | 0x0                | 0          | size only    |
| readonly-390  | toolbar        | ok             | 0x0                | 0          | 0.00%        |
| readonly-390  | days-label     | ok             | 0x0                | 0          | 2.79%        |
| readonly-390  | days           | ok             | 0x36               | 0          | 12.51%       |
| readonly-390  | day-first      | ok             | 0x18               | 0          | 3.80%        |
| readonly-390  | daycard-modes  | ok             | 0x0                | 0          | 0.50%        |
| readonly-390  | daycard-head   | ok             | 0x0                | 0          | size only    |
| readonly-390  | daycard        | ok             | 0x0                | 0          | size only    |
| readonly-390  | inspector-head | absent in both |                    |            |              |
| readonly-390  | inspector      | absent in both |                    |            |              |
| selected-1440 | back           | ok             | 0x0                | 0          | size only    |
| selected-1440 | title          | ok             | 169x0              | 0          | size only    |
| selected-1440 | band-head      | ok             | 0x0                | 0          | size only    |
| selected-1440 | toolbar        | ok             | 0x0                | 0          | 0.00%        |
| selected-1440 | days-label     | ok             | 0x0                | 0          | 1.16%        |
| selected-1440 | days           | ok             | 0x18               | 0          | 4.42%        |
| selected-1440 | day-first      | ok             | 0x18               | 0          | 4.17%        |
| selected-1440 | daycard-modes  | ok             | 0x0                | 0          | 7.42%        |
| selected-1440 | daycard-head   | ok             | 0x28               | 0          | size only    |
| selected-1440 | daycard        | ok             | 0x28               | 0          | size only    |
| selected-1440 | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| selected-1440 | inspector      | ok             | 0x378              | 0          | size only    |
| selected-768  | back           | ok             | 0x0                | 0          | size only    |
| selected-768  | title          | ok             | 362x0              | 0          | size only    |
| selected-768  | band-head      | ok             | 0x0                | 0          | size only    |
| selected-768  | toolbar        | ok             | 0x0                | 0          | 0.00%        |
| selected-768  | days-label     | ok             | 0x0                | 0          | 0.00%        |
| selected-768  | days           | ok             | 0x18               | 0          | 6.00%        |
| selected-768  | day-first      | ok             | 0x18               | 0          | 5.82%        |
| selected-768  | daycard-modes  | ok             | 0x0                | 0          | 7.85%        |
| selected-768  | daycard-head   | ok             | 0x28               | 0          | size only    |
| selected-768  | daycard        | ok             | 0x16               | 0          | size only    |
| selected-768  | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| selected-768  | inspector      | ok             | 0x359              | 0          | size only    |
| selected-390  | back           | ok             | 0x0                | 0          | size only    |
| selected-390  | title          | ok             | 54x20              | 0          | size only    |
| selected-390  | band-head      | ok             | 0x0                | 0          | size only    |
| selected-390  | toolbar        | ok             | 0x0                | 0          | 2.99%        |
| selected-390  | days-label     | ok             | 0x0                | 0          | 0.00%        |
| selected-390  | days           | ok             | 0x36               | 0          | 12.11%       |
| selected-390  | day-first      | ok             | 0x18               | 0          | 4.76%        |
| selected-390  | daycard-modes  | ok             | 0x0                | 0          | 0.45%        |
| selected-390  | daycard-head   | ok             | 0x28               | 0          | size only    |
| selected-390  | daycard        | ok             | 0x28               | 0          | size only    |
| selected-390  | inspector-head | absent in both |                    |            |              |
| selected-390  | inspector      | absent in both |                    |            |              |
| warmup-1440   | back           | ok             | 0x0                | 0          | size only    |
| warmup-1440   | title          | ok             | 169x0              | 0          | size only    |
| warmup-1440   | band-head      | ok             | 0x0                | 0          | size only    |
| warmup-1440   | toolbar        | ok             | 0x0                | 0          | 0.00%        |
| warmup-1440   | days-label     | ok             | 0x0                | 0          | 1.16%        |
| warmup-1440   | days           | ok             | 0x18               | 0          | 4.42%        |
| warmup-1440   | day-first      | ok             | 0x18               | 0          | 4.17%        |
| warmup-1440   | daycard-modes  | ok             | 0x0                | 0          | 7.42%        |
| warmup-1440   | daycard-head   | ok             | 0x28               | 0          | size only    |
| warmup-1440   | daycard        | ok             | 0x28               | 0          | size only    |
| warmup-1440   | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| warmup-1440   | inspector      | ok             | 0x0                | 0          | size only    |
| warmup-768    | back           | ok             | 0x0                | 0          | size only    |
| warmup-768    | title          | ok             | 362x0              | 0          | size only    |
| warmup-768    | band-head      | ok             | 0x0                | 0          | size only    |
| warmup-768    | toolbar        | ok             | 0x0                | 0          | 0.00%        |
| warmup-768    | days-label     | ok             | 0x0                | 0          | 0.00%        |
| warmup-768    | days           | ok             | 0x18               | 0          | 6.00%        |
| warmup-768    | day-first      | ok             | 0x18               | 0          | 5.82%        |
| warmup-768    | daycard-modes  | ok             | 0x0                | 0          | 7.85%        |
| warmup-768    | daycard-head   | ok             | 0x28               | 0          | size only    |
| warmup-768    | daycard        | ok             | 0x16               | 0          | size only    |
| warmup-768    | inspector-head | ok             | 0x0                | 0          | 0.00%        |
| warmup-768    | inspector      | ok             | 0x0                | 0          | size only    |
| warmup-390    | back           | ok             | 0x0                | 0          | size only    |
| warmup-390    | title          | ok             | 54x20              | 0          | size only    |
| warmup-390    | band-head      | ok             | 0x0                | 0          | size only    |
| warmup-390    | toolbar        | ok             | 0x0                | 0          | 2.99%        |
| warmup-390    | days-label     | ok             | 0x0                | 0          | 0.00%        |
| warmup-390    | days           | ok             | 0x36               | 0          | 12.11%       |
| warmup-390    | day-first      | ok             | 0x18               | 0          | 4.76%        |
| warmup-390    | daycard-modes  | ok             | 0x0                | 0          | 0.45%        |
| warmup-390    | daycard-head   | ok             | 0x28               | 0          | size only    |
| warmup-390    | daycard        | ok             | 0x28               | 0          | size only    |
| warmup-390    | inspector-head | absent in both |                    |            |              |
| warmup-390    | inspector      | absent in both |                    |            |              |

0 landmark(s) differ outside the functional slots
