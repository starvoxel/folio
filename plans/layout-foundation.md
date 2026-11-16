# Plan: Layout foundation

| Field       | Value              |
| ----------- | ------------------ |
| Status      | Implemented        |
| Approved by | Jeremy, 2026-11-16 |
| Created     | 2026-11-16         |

## Goal

The app must look right at any window width and shape, ultrawide included, and must not be designed around one aspect ratio. Layouts are chosen by two independent inputs: the form-factor profile the host reports (desktop, web, tablet, phone) and the width class of the area the app has. Each profile can later have its own layouts. This plan builds the seam and the desktop profile only.

## Scope

- In: the profile and input style in `host-api`; the width classes, the layout registry and the resolver (pure, in the renderer package); the Fluent shell variants for the desktop profile (compact, regular, wide); an architecture check that keeps screens free of layout code; the decision record AD-21; unit tests and an integration matrix.
- Out: tablet and phone layouts (a new registry entry plus shell variants, later); code-splitting per profile; a runtime change of the input style; real content for wide screens (side panels arrive with the screens that have them).

## Approach

Decisions are in [AD-14](../knowledge/architecture/09_architecture_decisions.md#ad-14-package-layout-ui-state-and-testing) (thin components, pure modules unit tested), AD-15 (Fluent contained), AD-17 (one renderer for desktop, web and later mobile) and AD-19 (the host reports facts). The result is recorded as AD-21. The design notes (Shell) are updated in the same change.

1. Two separate inputs. The profile and the input style come from the host through `HostInfo` and are never guessed from the window width. The width class is computed in one place, from the measured width of the root element (not `window.innerWidth`, so a split view or an embedding still works), with its thresholds in one table.
2. A layout is a lookup `(profile, width class) → LayoutDefinition`: the navigation form, what the top bar shows and what moves to an overflow menu, and the content column rules (maximum width, padding step). A profile lists only the classes it needs.
3. Screens describe content and never positions or widths. An architecture check fails a screen that imports the layout modules or writes layout code (media query, `matchMedia`, a width read, an observer, `className`, inline `style`).
4. The pure logic lives in `packages/renderer/src/layout/` and imports neither React, Fluent nor the DOM. Fluent shell variants live under `packages/renderer/src/ui/fluent/`; the React glue (measuring the width, the context) lives in `app/`.
5. One bundle. Profiles are registry entries, so splitting by profile later changes the registry, not the screens.

## Milestones

### 1. Host facts and the pure layout module

- Does: `FormFactor` and `InputStyle` in `host-api`, added to `HostInfo` (desktop host: `desktop`, fine pointer, hover; mock: configurable). `layout/` with the width classes and thresholds, the `LayoutDefinition` types, the registry (desktop entries only) and `resolveLayout`. A pure `interactionFor(input)` that turns the input style into target size and hover behaviour.
- Acceptance criteria: unit tests cover every class boundary, the fallback chain and an unregistered profile; the layout folder imports no React, Fluent or DOM (architecture check).

### 2. Shell variants and the architecture check

- Does: a `LayoutProvider` and `useLayout` in `app/` that measure the root element and resolve the layout; `AppShell` picks a left-pane or a drawer variant; the top bar has a full and a compact variant with an overflow menu; the content region applies the content rules. The dependency-cruiser rule and the source check for screens.
- Acceptance criteria: the existing shell behaviour at regular width is unchanged; a deliberate violation in a fixture screen fails the architecture check.

### 3. Input style

- Does: the shell's own controls take their minimum target size from the input style (44 px for touch, 32 px otherwise); the hover rule is exposed (`hoverActions`) for controls that will reveal actions on hover; no control does yet. Nothing in the width class changes either.
- Acceptance criteria: with a coarse-pointer host the top bar buttons and navigation items are at least 44 px high at every width.

### 4. Tests, record and documents

- Does: an integration matrix over profile (desktop, web, tablet, phone) and width class at representative sizes, using Playwright device emulation for tablet and phone; AD-21; the design notes; README and `key_files` where they list files.
- Acceptance criteria: for every cell: no sideways scroll, the expected navigation form, a screenshot; all checks and test kinds pass.

## Requirements

- Accessibility: every control keeps an accessible name in every variant; the drawer closes on Escape and after choosing a page.
- Privacy: no change; the layout needs no new request and no stored data.

## Decisions

- Profile and input are host facts, read once at mount. A host whose input can change at run time (a tablet that gains a keyboard) needs a change subscription; that is added with the first host that needs it.
- Width is measured on the app's root element, in CSS pixels, so the resize that a scrollbar causes inside the page cannot flip the class.
- Touch target size and hover-free interaction belong to the input style, not the width class: a phone and a tablet differ in width but share touch, and a desktop window dragged narrow is still driven by a pointer. The registry therefore never carries them; `interactionFor` does.
- Navigation forms exist only when implemented: `leftPane` and `drawer` now. `rail` and `bottomBar` are added to the union together with the profile that uses them, so no variant is declared that nothing renders.
- Fallback for a class a profile does not define: the nearest narrower class the profile defines, then the profile default, then desktop. This refines the agreed rule, which sent `ultrawide` to the regular layout, narrower than wide. Desktop therefore lists compact, regular and wide: medium inherits compact, ultrawide inherits wide (Jeremy, 2026-11-16).
- Thresholds in CSS pixels: compact under 600, medium 600 to 899, regular 900 to 1599 (900 is the app's minimum window), wide 1600 to 2559, ultrawide 2560 and up, in one table (Jeremy, 2026-11-16).
- Desktop compact navigation is an overlay drawer opened from a navigation button in the top bar; the file menu entries and the commands move to an overflow menu. It is reached only by zooming or by a window below the 900 px minimum (Jeremy, 2026-11-16).
- Content width: regular 1240 as in the design notes, wide and ultrawide 1440, compact full width; the design notes are updated in the same change (Jeremy, 2026-11-16).
- Tests: the matrix passes the profile and the input style to the mock host through the URL of the test page; only the test entry reads them.

## Open questions

None open. The four questions asked before implementation were answered with the recommendations (Jeremy, 2026-11-16), recorded under Decisions.
