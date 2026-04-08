---

## name: Financial Architect UI Design
description: UI and visual design rules for The Financial Architect — follow DESIGN.md and design/*.html mocks. Use this for ANY UI work.

# Financial Architect — design rules

When building or changing **UI, layout, styles, or components** in this repo:

1. **Read first**: `[DESIGN.md](../../../DESIGN.md)` (normative). It defines surfaces, typography, tables, toggles, elevation, breadcrumbs, and do/don’t rules.
2. **Screen reference**: For each route/screen, open the matching static mock under `[design/](../../../design/)`. Prefer structure, spacing, copy tone, and component patterns from that HTML — implement in React + shadcn + Tailwind, not by pasting CDN-only snippets blindly.


| Screen             | Mock file                                           |
| ------------------ | --------------------------------------------------- |
| Login              | `design/login/code.html`                            |
| Dashboard / Início | `design/dashboard/code.html`                        |
| Tipos              | `design/tipos_de_investimento/code.html`            |
| Perguntas por tipo | `design/perguntas_por_tipo/code.html`               |
| Lista + ranking    | `design/lista_de_investimentos_e_ranking/code.html` |
| Pontuação          | `design/pontua_o_do_investimento/code.html`         |


1. **Tokens**: Centralize colors from the mocks’ `tailwind.config.theme.extend.colors` in the app’s Tailwind config; map to shadcn CSS variables where appropriate. If a mock uses `slate-`* utilities alongside semantic tokens, **resolve toward `DESIGN.md` semantic surfaces** (`surface`, `surface-container-`*, `on-surface`, etc.).
2. **Non-negotiables from DESIGN.md**:
  - No 1px solid borders for sectioning; use background tier shifts.
  - Data tables: no horizontal row dividers; vertical gap between rows; subtle row hover (`surface-container-low`); column headers uppercase, `outline` tone, label scale.
  - Sim/Não toggles: track `surface-container-highest`; Sim uses `primary` (#000000); Não uses `surface-variant`.
  - Floating chrome: glass (~80% opacity + `backdrop-blur` ~12px) and ambient shadow `0px 12px 32px -4px rgba(25, 28, 30, 0.06)` where specified.
  - Typography: **Manrope** for display/headlines, **Inter** for UI/body/labels.
  - Breadcrumbs: slash `/` separators with `surface-dim`, not arrow glyphs.
  - Links: not default blue; `primary` with `surface_tint` underline treatment per DESIGN.md.
3. **Icons**: Mocks use **Material Symbols Outlined**. Prefer the same family for parity; if you substitute (e.g. Lucide), keep stroke weight and scale consistent with the mock hierarchy.
4. **Do not** introduce generic layouts that contradict **organic asymmetry**, tonal layering, or the no-border table rule. Do not add decorative scope beyond what DESIGN.md and the relevant mock imply.

