# VISCRETE Frontend Design Rules

This document defines the design system, color palette, and formatting conventions used across the VISCRETE frontend. All pages must conform to the appropriate surface context described below.

---

## 1. Surface Contexts

There are three distinct surface contexts in this application. All three support both **light and dark mode**. Never mix surface contexts.

| Context | Used In | Light Background | Dark Background |
|---|---|---|---|
| **Landing** | `app/page.tsx`, landing components | `bg-white` | `dark:bg-[#14171e]` |
| **App** | `app/upload/`, `app/preprocess/`, etc. | `bg-gray-50` | `dark:bg-[#0a0a0a]` |
| **Pipeline** | `app/results/`, `app/detect/`, `app/report/` | `bg-gray-100` | `dark:bg-gray-900` |

> The `dark:` variant is controlled by the `ThemeProvider` (next-themes) toggling the `.dark` class on `<html>`. Always write both light and dark values for every color token.

---

## 2. Color Palette

### 2.1 Landing Surface

Used **only** on `app/page.tsx` and its components (`HeroSection`, `StatsSection`, `TechnologySection`, etc.).

#### Backgrounds

| Role | Light | Dark |
|---|---|---|
| Page base | `bg-white` | `dark:bg-[#14171e]` |
| Surface / card | `bg-gray-50` | `dark:bg-[#101115]` |
| Section alt | `bg-gray-100` | `dark:bg-[#101115]` |
| Icon container | `bg-emerald-50` | `dark:bg-[#1e4032]` |
| Badge background | `bg-emerald-50` | `dark:bg-[#1e4032]` |

#### Borders

| Role | Light | Dark |
|---|---|---|
| Card / section border | `border-emerald-200` | `dark:border-[#1e4032]` |
| Badge border | `border-emerald-300` | `dark:border-[#2ca75d]/30` |
| Grid overlay | `border-emerald-100/50` | `dark:border-[#2ca75d15]` |

#### Text

| Role | Light | Dark |
|---|---|---|
| Primary heading | `text-gray-900` | `dark:text-white` |
| Body / description | `text-gray-600` | `dark:text-gray-400` |
| Brand label (mono) | `text-emerald-700` | `dark:text-[#2ca75d]` |
| Stat value (highlight) | `text-emerald-600` | `dark:text-[#2ca75d]` |
| Stat value (normal) | `text-gray-900` | `dark:text-white` |

#### Brand Colors (mode-invariant)

These colors remain the same in both light and dark mode.

| Role | Value | Usage |
|---|---|---|
| Brand green | `#2ca75d` | Primary accent, icons, highlights |
| Brand blue | `#0da6f2` | Secondary accent, outlines, labels |
| CTA yellow | `#e5ac0c` | Primary call-to-action button |

#### Brand Gradient (headline, brand mark)

```
bg-gradient-to-r from-[#2ca75d] to-[#0da6f2] bg-clip-text text-transparent
```

#### Grid Background Pattern

```
bg-[linear-gradient(to_right,#2ca75d15_1px,transparent_1px),
    linear-gradient(to_bottom,#2ca75d15_1px,transparent_1px)]
bg-[size:14px_24px]
[mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]
```

> In light mode, reduce grid opacity further or use an emerald-tinted grid:
> `bg-[linear-gradient(to_right,#2ca75d0d_1px,transparent_1px),linear-gradient(to_bottom,#2ca75d0d_1px,transparent_1px)]`

#### Feature Cards (Landing)

```jsx
<div className="group p-6 rounded-lg transition-colors
                border border-emerald-100 bg-gray-50
                hover:border-emerald-300
                dark:border-[#1e4032] dark:bg-[#101115]
                dark:hover:border-[#2ca75d]/50">
  <div className="mb-4 w-10 h-10 rounded-md flex items-center justify-center transition-colors
                  bg-emerald-50 group-hover:bg-emerald-100
                  dark:bg-[#1e4032] dark:group-hover:bg-[#2ca75d]/20">
    <Icon className="w-5 h-5 text-emerald-600 dark:text-[#2ca75d]" />
  </div>
  <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">…</h3>
  <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">…</p>
</div>
```

---

### 2.2 App Surface

Used across all form, upload, validation, job list, and preprocessing pages.

#### Backgrounds

| Role | Light | Dark |
|---|---|---|
| Page | `bg-gray-50` | `dark:bg-[#0a0a0a]` |
| Card / panel | `bg-white` | `dark:bg-[#161616]` |
| Header | `bg-white` | `dark:bg-[#111]` |
| Input field | `bg-white` | `dark:bg-[#1a1a1a]` |
| Row / item | `bg-gray-50` | `dark:bg-gray-900` |
| Hover row | `hover:bg-blue-50/50` | `dark:hover:bg-blue-950/20` |
| Selected row | `bg-blue-50/60` | `dark:bg-blue-950/30` |

#### Borders

| Role | Light | Dark |
|---|---|---|
| Card border | `border-gray-200` | `dark:border-gray-800` |
| Header border | `border-gray-200` | `dark:border-gray-800` |
| Input border | `border-gray-300` | `dark:border-gray-700` |
| Row border | `border-gray-100` | `dark:border-gray-800` |
| Row hover border | `hover:border-blue-300` | `dark:hover:border-blue-700` |
| Divider | `border-gray-100` | `dark:border-gray-800` |

#### Text

| Role | Light | Dark |
|---|---|---|
| Primary | `text-gray-900` | `dark:text-white` |
| Secondary / meta | `text-gray-500` | `dark:text-gray-400` |
| Muted / hint | `text-gray-400` | `dark:text-gray-500` |
| Section label | `text-gray-500` | `dark:text-gray-400` |

#### Interactive Colors

| Role | Classes |
|---|---|
| Primary action (blue) | `bg-blue-600 hover:bg-blue-700 text-white` |
| Success action | `bg-emerald-600 hover:bg-emerald-700 text-white` |
| Danger / delete | `bg-red-600 hover:bg-red-700 text-white` |
| Disabled | `bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed` |
| Focus ring | `focus:ring-2 focus:ring-blue-500 focus:border-transparent` |

#### Logo / Brand Mark

```jsx
<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600
                flex items-center justify-center">
  <FileImage className="w-4 h-4 text-white" />
</div>
```

#### Status Badge Colors

| Status | Light | Dark |
|---|---|---|
| `created` | `bg-gray-100 text-gray-700` | `dark:bg-gray-800 dark:text-gray-300` |
| `validating` | `bg-blue-100 text-blue-700` | `dark:bg-blue-900 dark:text-blue-300` |
| `validated` | `bg-green-100 text-green-700` | `dark:bg-green-900 dark:text-green-300` |
| `failed` | `bg-red-100 text-red-700` | `dark:bg-red-900 dark:text-red-300` |
| `preprocessing` / `preprocessed` | `bg-yellow-100 text-yellow-700` | `dark:bg-yellow-900 dark:text-yellow-300` |
| `detecting` / `detected` | `bg-orange-100 text-orange-700` | `dark:bg-orange-900 dark:text-orange-300` |
| `reporting` | `bg-purple-100 text-purple-700` | `dark:bg-purple-900 dark:text-purple-300` |
| `completed` | `bg-emerald-100 text-emerald-700` | `dark:bg-emerald-900 dark:text-emerald-300` |

#### Toast Notifications

| Type | Classes |
|---|---|
| Error | `bg-red-600 text-white` |
| Warning | `bg-amber-500 text-black` |

---

### 2.3 Pipeline Surface

Used in `app/results/`, `app/detect/`, `app/preprocess/[job_id]/`, and `app/report/`.

#### Backgrounds

| Role | Light | Dark |
|---|---|---|
| Page | `bg-gray-100` | `dark:bg-gray-900` |
| Sidebar / panel | `bg-white` | `dark:bg-gray-950` |
| Nav / header | `bg-white border-gray-200` | `dark:bg-gray-950 dark:border-gray-800` |
| Card / section | `bg-white border-gray-200` | `dark:bg-gray-950 dark:border-gray-800` |
| Table row hover | `hover:bg-gray-50` | `dark:hover:bg-gray-900/50` |
| Dashed image area | `bg-gray-200/40 border-gray-300` | `dark:bg-gray-800/30 dark:border-gray-700/50` |
| Overlay control bar | `bg-white/90 border-gray-200` | `dark:bg-gray-950/90 dark:border-gray-700` |

#### Text

| Role | Light | Dark |
|---|---|---|
| Primary | `text-gray-900` | `dark:text-white` |
| Secondary | `text-gray-600` | `dark:text-gray-400` |
| Muted | `text-gray-400` | `dark:text-gray-500` |

#### Dividers

| Role | Light | Dark |
|---|---|---|
| Horizontal rule | `bg-gray-200` | `dark:bg-gray-800` |
| Border divider | `border-gray-200` | `dark:border-gray-800` |

#### Defect Class Colors (mode-invariant)

Defect colors are semantic and consistent across light and dark.

| Defect | Border | Fill overlay | Label bg | Dot |
|---|---|---|---|---|
| `cracks` | `border-red-500` | `bg-red-500/20` | `bg-red-500` | `bg-red-500` |
| `spalling` | `border-yellow-500` | `bg-yellow-500/20` | `bg-yellow-500` | `bg-yellow-500` |
| `peeling` | `border-orange-500` | `bg-orange-500/20` | `bg-orange-500` | `bg-orange-500` |
| `algae` | `border-green-500` | `bg-green-500/20` | `bg-green-500` | `bg-green-500` |
| `staining` | `border-purple-500` | `bg-purple-500/20` | `bg-purple-500` | `bg-purple-500` |

#### Severity Colors (mode-invariant)

| Severity | Text | Badge bg | Track bg |
|---|---|---|---|
| Low | `text-emerald-400` | `bg-emerald-500` | `bg-emerald-950/50` |
| Medium | `text-amber-400` | `bg-amber-500` | `bg-amber-950/50` |
| High | `text-red-400` | `bg-red-500` | `bg-red-950/50` |

#### Stat Cards (sidebar)

| Category | Light | Dark |
|---|---|---|
| Total | `border-blue-200 bg-blue-50` / `text-blue-600` | `dark:border-blue-900/50 dark:bg-blue-950/30` / `dark:text-blue-400` |
| Cracks | `border-red-200 bg-red-50` / `text-red-600` | `dark:border-red-900/50 dark:bg-red-950/30` / `dark:text-red-400` |
| Spalling | `border-yellow-200 bg-yellow-50` / `text-yellow-600` | `dark:border-yellow-900/50 dark:bg-yellow-950/30` / `dark:text-yellow-400` |
| Peeling | `border-orange-200 bg-orange-50` / `text-orange-600` | `dark:border-orange-900/50 dark:bg-orange-950/30` / `dark:text-orange-400` |
| Algae | `border-green-200 bg-green-50` / `text-green-600` | `dark:border-green-900/50 dark:bg-green-950/30` / `dark:text-green-400` |
| Staining | `border-purple-200 bg-purple-50` / `text-purple-600` | `dark:border-purple-900/50 dark:bg-purple-950/30` / `dark:text-purple-400` |

#### Overlay Control Bar (Pipeline)

```jsx
<div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-6 py-3
                dark:bg-gray-950/90 dark:border-gray-700">
```

#### Pill / Class Toggle Button (Pipeline)

```jsx
<button className={cn(
  'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all',
  active
    ? 'bg-gray-100 border-gray-400 text-gray-900 dark:bg-gray-800 dark:border-gray-500 dark:text-white'
    : 'bg-transparent border-gray-300 text-gray-400 dark:border-gray-700 dark:text-gray-500',
)}>
```

---

## 3. Typography

### Font Families

| Role | Class | Notes |
|---|---|---|
| Body / UI | (default sans) | Geist Sans via `--font-geist-sans` |
| Code / mono labels | `font-mono` | Geist Mono — job IDs, version strings, platform labels |

### Scale & Weight

| Element | Classes |
|---|---|
| Page title (landing h1) | `text-6xl md:text-8xl font-bold tracking-tight` |
| Section heading | `text-3xl md:text-4xl font-bold text-gray-900 dark:text-white` |
| Page heading (app / pipeline) | `text-2xl font-bold text-gray-900 dark:text-white` |
| Card / panel heading | `text-base font-bold tracking-wide text-gray-900 dark:text-white` |
| Section label | `text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400` |
| Body | `text-sm text-gray-700 dark:text-gray-300` |
| Caption / meta | `text-xs text-gray-400 dark:text-gray-500` |
| Stat value (landing) | `text-4xl md:text-5xl font-bold font-mono` |

---

## 4. Spacing & Layout

### Containers

| Context | Class |
|---|---|
| Landing sections | `container max-w-4xl mx-auto px-6` or `max-w-5xl` / `max-w-6xl` |
| App pages | `max-w-7xl mx-auto px-6` |
| Pipeline pages | Full-width flex layout (no `max-w` container) |

### Common Padding

| Element | Class |
|---|---|
| Page main | `py-8 px-6` |
| Card / panel | `p-6` |
| Input field | `px-3 py-2` |
| Button (default) | `px-4 py-2.5` |
| Row item | `px-3 py-3` |
| Section vertical | `py-16` to `py-24` |

### Grid

- Two-column app layout: `grid grid-cols-1 lg:grid-cols-2 gap-8`
- Feature cards (landing): `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- Stat sidebar (pipeline): `grid grid-cols-2 gap-3`

---

## 5. Border Radius

| Element | Class |
|---|---|
| Cards / panels | `rounded-2xl` |
| List rows / items | `rounded-xl` |
| Inputs / buttons | `rounded-lg` |
| Badges / pills | `rounded-full` |
| Icon containers (landing) | `rounded-md` |
| Logo icon container | `rounded-lg` |
| Toggle / switch track | `rounded-full` |

---

## 6. Component Conventions

### Card (App surface)

```jsx
<div className="bg-white dark:bg-[#161616] rounded-2xl
                border border-gray-200 dark:border-gray-800
                p-6 shadow-sm">
```

### Card (Pipeline surface)

```jsx
<div className="bg-white dark:bg-gray-950 rounded-2xl
                border border-gray-200 dark:border-gray-800
                p-6">
```

### Section Label

```jsx
<h3 className="text-sm font-semibold uppercase tracking-wider mb-4
               text-gray-500 dark:text-gray-400">
```

### Primary Button

```jsx
<button className="bg-blue-600 hover:bg-blue-700 text-white
                   text-sm font-semibold px-4 py-2.5 rounded-lg transition">
```

### Input Field

```jsx
<input className="w-full px-3 py-2 rounded-lg text-sm
                  border border-gray-300 dark:border-gray-700
                  bg-white dark:bg-[#1a1a1a]
                  text-gray-900 dark:text-white
                  placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  focus:border-transparent transition" />
```

### Toggle Switch

```jsx
<div className={`w-10 h-6 rounded-full relative transition-colors
                 ${active ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all
                   ${active ? 'right-1' : 'left-1'}`} />
</div>
```

### Logo / Brand Mark

```jsx
<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600
                flex items-center justify-center">
  <FileImage className="w-4 h-4 text-white" />
</div>
```

### Header (App / Pipeline)

```jsx
<header className="border-b border-gray-200 dark:border-gray-800
                   bg-white dark:bg-[#111]">         {/* App */}
<header className="border-b border-gray-200 dark:border-gray-800
                   bg-white dark:bg-gray-950">       {/* Pipeline */}
```

---

## 7. Icons

- Library: **lucide-react** (primary), **@mui/material Icons** (secondary, limited legacy use)
- Prefer `lucide-react` for all new icons; do not add new MUI icon imports
- Standard sizes:

| Size | Class | Usage |
|---|---|---|
| XS | `w-3 h-3` | Inline / meta text |
| SM | `w-4 h-4` | Buttons, row icons |
| MD | `w-5 h-5` | Overlay controls, nav actions |
| LG | `w-6 h-6` | Nav bar icons |
| XL | `w-8 h-8` – `w-10 h-10` | Hero / empty state illustrations |

---

## 8. Shadows & Elevation

| Level | Light | Dark | Used For |
|---|---|---|---|
| Low | `shadow-sm` | `shadow-sm` | Cards, panels (App surface) |
| None | — | — | Pipeline surface cards (border only) |
| Backdrop | `backdrop-blur-sm` | `backdrop-blur-sm` | Floating overlay control bars |

---

## 9. Do's and Don'ts

**Do:**
- Always write both light and dark values for every color token — all three surfaces support both modes
- Use `transition` on all interactive elements (buttons, rows, borders, colors)
- Use `cursor-pointer` explicitly on clickable non-`<button>` elements (`<div>`, `<label>`)
- Add `shrink-0` to icons and badges inside flex rows to prevent squishing
- Use `min-w-0` + `truncate` on text inside flex containers that may overflow
- Use `e.stopPropagation()` on nested interactive elements inside clickable rows
- Use `<div onClick={…}>` with proper `cursor-pointer` instead of nested `<button>` inside `<button>`

**Don't:**
- Use hardcoded dark-only values (e.g., bare `bg-gray-900`, `text-white`) without a light-mode pair
- Use Landing palette hex values (`#14171e`, `#101115`, `#1e4032`) in App or Pipeline components
- Use App palette values (`bg-white dark:bg-[#161616]`) in Landing components
- Use `object-contain` on a fixed-size container without computing the rendered image rect for overlays
- Add `overflow-hidden` to an overlay container that needs to show floating labels outside its bounds
- Nest `<button>` inside `<button>` — invalid HTML
- Add new MUI icon imports — use lucide-react instead
