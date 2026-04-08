# Design System Specification: The Financial Architect

## 1. Overview & Creative North Star

**Creative North Star: "The High-Fidelity Ledger"**
Financial management is often reduced to cold grids and utilitarian boxes. This design system rejects the "SaaS-default" look in favor of an editorial, high-fidelity experience. We treat financial data not as a chore to be managed, but as a story to be told.

By leveraging **Organic Asymmetry** and **Tonal Depth**, we move away from rigid, bordered layouts. The interface should feel like a premium physical workspace—layered sheets of heavy stock paper, subtle transitions of light, and authoritative typography. We prioritize "white space as a component," using the spacing scale to create breathing room that signals luxury and calm in the often-stressed world of finance.

---

## 2. Colors & Surface Philosophy

The palette is rooted in deep, authoritative blues (`primary`) and growth-oriented emeralds (`tertiary`), balanced against a sophisticated neutral scale.

- **The "No-Line" Rule:** Explicitly prohibit 1px solid borders for sectioning. Structural boundaries are defined solely by background color shifts. A `surface-container-low` section sitting on a `surface` background provides all the separation necessary.
- **Surface Hierarchy & Nesting:** Treat the UI as a series of physical layers.
- **Base:** `surface` (#f7f9fb)
- **Subtle Content Areas:** `surface-container-low` (#f2f4f6)
- **Active Cards/Modals:** `surface-container-lowest` (#ffffff)
- **The Glass & Gradient Rule:** For floating elements or top-level navigation, use Glassmorphism. Apply `surface_container_lowest` at 80% opacity with a `backdrop-filter: blur(12px)`.
- **Signature Textures:** Main Action buttons or "Growth" indicators should utilize a subtle linear gradient (e.g., `tertiary_fixed` to `on_tertiary_container`) to provide a "jewel-toned" depth that feels high-end.

---

## 3. Typography

We employ a dual-typeface strategy to balance character with extreme legibility.

- **Display & Headlines (Manrope):** Use Manrope for all `display` and `headline` scales. Its geometric nature and wide apertures feel modern and architectural.
- *Usage:* Large portfolio balances, page headers, and "hero" metrics.
- **Interface & Body (Inter):** Use Inter for `title`, `body`, and `label` scales. Inter is engineered for readability in data-heavy environments.
- *Usage:* Table data, form labels, and granular financial breakdowns.
- **Editorial Contrast:** Create high-contrast layouts by pairing `display-md` (2.75rem) balances with `label-sm` (0.6875rem) descriptors in `on_surface_variant` (#45464d).

---

## 4. Elevation & Depth

In this system, elevation is an environmental property, not a structural line.

- **Tonal Layering:** Avoid shadows for static cards. Instead, stack `surface-container-lowest` cards on a `surface-container-low` background. This creates a "soft lift" that feels integrated into the architecture.
- **Ambient Shadows:** When an element must "float" (e.g., a dropdown or a Sim/Não toggle popover), use a custom shadow: `0px 12px 32px -4px rgba(25, 28, 30, 0.06)`. This uses the `on_surface` color for the tint, mimicking natural light.
- **The Ghost Border:** If a boundary is required for accessibility (e.g., an input field), use the `outline_variant` (#c6c6cd) at **20% opacity**. Never use 100% opaque borders.

---

## 5. Components

### Metrics & Subtle Cards

- **Style:** No borders. Background: `surface-container-lowest`.
- **Content:** Metrics should feature a `headline-lg` value in `on_surface`.
- **Growth Indicator:** Use `tertiary_fixed_dim` (#4edea3) with a soft `on_tertiary_fixed_variant` text for positive growth.

### Data Tables (TanStack Style)

- **The Row Rule:** Forbid the use of horizontal divider lines.
- **Separation:** Use a `0.5rem` (spacing 2.5) vertical gap between rows. Give each row a very subtle `surface-container-low` background on hover to indicate interactivity.
- **Typography:** Column headers must be `label-md` in `outline` (#76777d) with all-caps styling.

### Inputs & Toggles (Sim/Não)

- **Inputs:** `surface-container-highest` background, no border, `md` (0.375rem) roundedness.
- **Sim/Não Toggles:** The toggle track should be `surface-container-highest`. The active "Sim" state uses `primary` (#000000) for high-contrast authority; "Não" uses `surface-variant`.
- **Buttons:**
- *Primary:* `primary_container` (#111c2d) background with `on_primary` (#ffffff) text.
- *Tertiary (Success):* `tertiary_container` (#002113) background with `tertiary_fixed` text.

### Breadcrumbs & Navigation

- Use `body-sm` typography. Avoid arrows; use a simple `surface-dim` forward slash `/` to maintain the editorial feel.

---

## 6. Do's and Don'ts

### Do:

- **Do** use asymmetrical padding (e.g., `spacing-10` on the left, `spacing-8` on the right) in hero sections to create a "custom-build" look.
- **Do** use `surface_bright` to highlight the most important action on a screen.
- **Do** allow data to breathe. Use `spacing-12` or `spacing-16` between major dashboard sections.

### Don't:

- **Don't** use 1px solid black or grey borders. Use background color shifts.
- **Don't** use standard blue for links. Use the `primary` token (#000000) with a `surface_tint` underline for a more sophisticated financial aesthetic.
- **Don't** crowd the dashboard. If a metric isn't vital, move it to a secondary "Details" view to maintain the "Clarity" value proposition.