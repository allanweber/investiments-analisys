# AGENTS.md — instructions for coding agents (LLMs)

**Purpose**: short, **machine-checkable** product and stack decisions. Do **not** treat this as the full spec.

**Canonical technical plan** (schema, implementation order, deploy, edge cases):

- `plans/tanstack_start_mvp_7b936246.plan.md` — update when decisions change.

**Before implementing UI**: read `DESIGN.md`, then the static mock `design/<screen>/screen.png` from the table below.

For **human-readable** vision and MVP scope in prose: `plan.md`.

---

## Mock → screen map

| Screen            | File                                                 |
| ----------------- | ---------------------------------------------------- |
| Login             | `design/login/screen.png`                           |
| Dashboard / home  | `design/dashboard/screen.png`                       |
| Investment types  | `design/tipos_de_investimento/screen.png`           |
| Questions by type | `design/perguntas_por_tipo/screen.png`              |
| List + ranking    | `design/lista_de_investimentos_e_ranking/screen.png` |
| Scoring (Y/N)     | `design/pontua_o_do_investimento/screen.png`        |

---

## Stack (MVP) — fixed unless user overrides

- **App**: TanStack Start (React, TypeScript, Tailwind); TanStack **Router**, **Form**, **Table** as needed.
- **Packages**: **pnpm** (lockfile, scripts; use `pnpm create` / `pnpm dlx` for generators).
- **Repo layout**: application at **repository root** (alongside `DESIGN.md`, `design/`, `plans/`), not under `apps/web`.
- **Auth**: Better Auth — **email/password** + **Google**; Drizzle adapter; server functions **must** enforce session (**401** if unauthenticated).
- **DB**: PostgreSQL + **Drizzle**; `DATABASE_URL`.
- **UI**: shadcn/ui; visual rules + tokens in `DESIGN.md`; Cursor rule `.agents/rules/financial-architect-design.mdc`.

---

## Routes — conventions

- **`/`** → redirect **`/dashboard`** (post-login hub).
- **`/login`**: on success → **`/dashboard`** (do not assume `/` as the final destination).
- **Domain paths** (adapt to Start file-router prefixes if required; semantics stay the same):
  - `/tipos`
  - `/tipos/$typeId/perguntas`
  - `/investimentos`
  - `/investimentos/$id/pontuacao`

---

## Domain rules — implement exactly

**Tenancy**: all domain rows scoped by **`user_id`**.

**Scoring**

- For each **active** question **answered**: Yes ⇒ **+1**, No ⇒ **−1**; **no answer** ⇒ **0** in sum; UI shows unanswered state.
- **Inactive** questions: excluded from score and from the “active questions” denominator; `investment_answer` rows may remain in DB.

**Ranking**

- Meaningful **only within one `investment_type`** (scores across types are not comparable).
- Investment list filter **“all types”**: **group by type**; sort and show **rank/position per group** only.

**Deletes (avoid accidental cascade)**

- **Investment type**: **block** delete if any question or investment exists for that type.
- **Question**: **block** hard delete if any `investment_answer` exists; prefer **`active = false`**.
- **Investment**: user-initiated delete allowed (drops that investment and its answers).
- **Change investment’s type**: **block** if any answer exists (plan option A).

**Uniqueness**

- **Do not** enforce unique investment name per `(user_id, investment_type_id)` — duplicates allowed.

**Onboarding**

- **Auto-seed** default investment types **after signup** (idempotent per user); type list in technical plan.

---

## Design — agent summary

- **North star**: The Financial Architect — “The High-Fidelity Ledger” (`DESIGN.md`).
- **Surfaces**: layered backgrounds; **no** 1px layout borders; inputs may use `outline_variant` ~**20%** opacity.
- **Tables**: no horizontal rules between rows; vertical rhythm; row hover `surface-container-low`; headers uppercase, `outline`.
- **Yes/No toggles**: track `surface-container-highest`; Yes = `primary`; No = `surface-variant`.
- **Type**: Manrope (headlines), Inter (UI/body).
- **Chrome**: glass + blur on top nav; ambient shadow only on floating panels per `DESIGN.md`.
- **Tokens**: single `tailwind.config` `extend.colors`; if mocks conflict with `slate-*`, prefer `DESIGN.md` semantics.
- **Icons**: mocks use Material Symbols Outlined — match or document substitute.
- **Theme**: **light + dark** in MVP (`DESIGN.md` / `dark:` in mocks).

Also: `.agents/skills/financial-architect-design/SKILL.md` (Antigravity skill).
