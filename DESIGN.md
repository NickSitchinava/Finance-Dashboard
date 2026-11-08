---
name: F-Dash
description: A calm, precise finance workspace with confident violet emphasis.
colors:
  persian: "#27187e"
  sidebar-deep: "#150c4a"
  violet-interactive: "#4935a5"
  violet-focus: "#7664cc"
  ghost: "#f7f7ff"
  white: "#ffffff"
  lavender-surface: "#eeebfa"
  ink: "#211b3b"
  muted: "#736e83"
  line: "#ddd9e9"
  sidebar-text: "#c9c0eb"
  overdue: "#aa5e59"
typography:
  metric:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(20px, 1.9vw, 28px)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.05em"
  page-title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 750
    letterSpacing: "-0.025em"
  panel-title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  navigation:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
  compact-label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 750
rounded:
  compact: "7px"
  control: "9px"
  panel: "14px"
spacing:
  tight: "7px"
  card-gap: "12px"
  panel-gap: "13px"
  panel-inset: "19px"
  page-inset: "32px"
components:
  button-primary:
    backgroundColor: "{colors.persian}"
    textColor: "{colors.white}"
    rounded: "8px"
    height: "34px"
    padding: "0 12px"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.violet-interactive}"
    rounded: "8px"
    height: "34px"
    padding: "0 12px"
  dashboard-panel:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "18px 19px"
  dashboard-metric:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "15px 16px"
  sidebar-link:
    backgroundColor: "{colors.sidebar-deep}"
    textColor: "{colors.sidebar-text}"
    rounded: "{rounded.compact}"
    height: "44px"
    padding: "0 12px"
---

# Design System: F-Dash

## Overview

**Creative North Star: "The Violet Ledger"**

F-Dash's new direction combines a deep violet navigation rail with a bright, quiet work surface. It should feel calm and precise in its organization, then confident and vivid where the user needs a focal point. Dense financial information stays easy to scan through clear grouping, tabular numerals, and restrained use of the strongest purple.

This record is based on the updated sidebar, top bar, Overview, Finances, Projects, Clients, and Invoices. These screens establish the direction for future work. Older dark and orange styles still present on other routes are migration gaps. The name above is a descriptive label for the observed system, not a product claim.

**Key Characteristics:**

- Deep violet navigation beside a Ghost canvas and white data panels.
- Compact, aligned cards and lists with a limited number of strong KPI accents.
- Finance, project, client, and invoice workspaces use the same light canvas while retaining layouts suited to their tasks.
- Small but deliberate shadows, cool borders, and violet interaction states.
- Clear operational copy and chart labels; status colors convey urgency rather than decoration.

## Colors

The palette moves from a dark violet rail to a light, cool workspace. Frontmatter color values are normative.

### Primary

- **Persian:** The main brand anchor for the primary KPI, save actions, active navigation accents, and chart emphasis.
- **Deep Violet:** The fixed sidebar surface; it gives navigation a distinct layer without darkening the work area.
- **Interactive Violet:** Links, small icons, and hover emphasis on the light surface.

### Secondary

- **Lavender Surface:** Selected or informative areas, including the tinted KPI and Daily Briefing panel.
- **Focus Violet:** Visible keyboard focus and the stronger edge of interactive states.

### Tertiary

- **Overdue:** Muted red for overdue text and attention indicators. Reserve it for actual status.

### Neutral

- **Ghost:** The shared canvas behind updated workspaces and the matching top bar.
- **White:** Default data panels and controls.
- **Ink:** Main content text and numeric values on light surfaces.
- **Muted:** Descriptions, dates, axes, and secondary labels.
- **Line:** Fine card borders and divisions.
- **Sidebar Text:** Resting navigation labels on deep violet.

**The Purposeful Purple Rule.** Use the strongest violet for active navigation, important actions, and a small number of focal metrics; let white and Ghost carry ordinary data.

## Typography

**Display Font:** Inter with the system sans-serif stack.
**Body Font:** Inter with the same fallbacks.

**Character:** A single sans family keeps the dashboard direct. Heavy, tightly tracked numbers and panel titles give it confidence; smaller supporting labels stay compact and quiet.

### Hierarchy

- **Metric:** Heavy, tabular, tightly tracked figures for KPI values and financial summaries. The primary KPI scales from 20 to 28px on desktop.
- **Page title:** The overview top bar uses a 20px title at weight 750.
- **Panel title:** A 16px, weight 800 heading anchors each widget.
- **Navigation:** 14px medium labels remain readable in the rail.
- **Compact label:** 11px bold labels identify KPI fields, controls, and short data rows. Supporting notes and dates are usually 10–12px.

**The Numbers First Rule.** Align figures with tabular numerals and keep labels visually subordinate to the values they explain.

## Layout

The sidebar is a fixed 270px panel when expanded and a 68px rail when collapsed. It overlays the content while open; the main view retains a 68px left offset on desktop. At 768px and below it becomes an off-canvas drawer and the content fills the viewport.

Overview content is capped at 1500px. Its KPI group uses five columns at wide widths, rearranges to three and then two columns, and keeps a full-width final card on narrow screens. The lower widgets use a 12-column grid: finance receives eight columns beside attention at wide widths, while project, briefing, and recent activity panels occupy the subsequent rows. At 1100px and below, panels stack.

Finances arranges summary metrics above charts, breakdowns, and transaction tools. Projects uses four summary metrics above a project collection and detailed workspace. Clients uses a compact stats strip and CRM board. Invoices uses five summary metrics above attention and ledger sections. The regular card gap is about 11–13px; panels use roughly 18–19px inner padding, reduced on mobile. Each workspace adapts its data density through stacking or horizontal scrolling where appropriate.

These are information-dense operating surfaces. Preserve their compact rhythm and aligned edges when extending the system; keep data legible at 480px and 350px widths.

## Elevation & Depth

The system uses a hybrid of tonal separation, thin borders, and restrained shadows. White cards sit slightly above Ghost with a two-layer violet-tinted shadow. The featured KPI has a stronger violet shadow and gradient. The sidebar's right edge has a broader glow when expanded; controls and segmented selections receive a small hover or active lift.

### Shadow Vocabulary

- **Panel ambient:** `0 1px 2px #27187e0b, 0 8px 22px #27187e0b` for ordinary cards across the updated routes.
- **Featured KPI:** `0 2px 4px #27187e14, 0 12px 22px #27187e24` for the primary metric only.
- **Sidebar edge:** `12px 0 32px rgba(220,211,255,.18)` for the expanded rail.

**The Light Surface Rule.** Default data panels stay white with a fine cool border; use violet fills for selected, informative, or focal surfaces.

## Shapes

Summary cards and panels have gently rounded 14px corners. Compact controls and rail links use 7–9px corners. Circular forms are limited to avatars, status dots, and the faint rings on the featured KPI. Dividers are thin and cool; the interface does not rely on thick outlines for hierarchy.

## Components

### Buttons

- **Primary:** A Persian fill with white 12px bold text, 34px height, 8px radius, and 12px horizontal padding; used for saving an overview layout.
- **Secondary:** White with a cool border and violet text for cancel or low-priority actions.
- **Hover / Focus:** Hover lightens a white action or deepens the violet emphasis. Keyboard focus uses a visible violet outline with space around the control.

### Cards / Containers

- **Default panel:** White, 14px radius, fine Line border, 18–19px padding, and the ambient shadow. The common surface is defined in `src/components/ui/DashboardMetricCard.css`; each page sets its own layout, padding, and any border variation.
- **Summary metric:** `DashboardMetricCard` in `src/components/ui/DashboardMetricCard.tsx` provides the shared label, value, and supporting detail structure for Overview, Finances, Projects, and Invoices. Page classes set size, typography, semantic tone, and responsive behavior. Loading placeholders keep the shared `dashboard-metric` surface class.
- **Featured KPI:** Violet gradient, white metric, brighter supporting labels, and a stronger shadow.
- **Tinted panel:** Lavender surface for a secondary highlight such as Daily Briefing.
- **Client workspace:** The stats strip and CRM board follow the same canvas, ink, line, and action colors, but keep their own structure because their meaning differs from summary cards.

### Navigation

The sidebar is deep violet with pale resting labels. Links are 44px high with 7px corners and 20px icons. Hover adds a translucent violet plane; active state combines white text, a subtle horizontal tint, and a 2px lavender left marker. The collapsed rail exposes tooltips and a hover-revealed expand control. On mobile it becomes a drawer with larger touch targets and no rail tooltip.

### Segmented Controls

Period and metric selectors sit inside pale lavender tracks with 9px outer corners. The selected segment is white with violet text and a small shadow. Unselected text is muted; hover shifts it toward Persian.

### Data Rows and Status

Attention, project, and recent transaction rows use thin top dividers and compact two-line text. Small violet blocks mark project or transaction identity. Overdue indicators use muted red, while upcoming deadlines use a restrained warm tone. These colors are functional signals and should not become general accents.

### Screen Patterns

- **Overview:** Lead with a five-card business summary, then use chart, attention, projects, briefing, and recent activity panels. A single featured metric anchors the row.
- **Finances:** Pair compact period and type controls with summary cards, charts, category breakdowns, and a transaction ledger. Income and expense colors describe financial meaning; the selected controls remain violet.
- **Projects:** Use a four-card summary above the project collection and workspace. Keep progress, due dates, and reviewed time legible in dense project cards and detail sections.
- **Clients:** Use a compact stats strip and CRM board. Client cards and editor controls use the same light canvas, violet actions, and cool borders; their layout follows the client workflow rather than the metric-card grid.
- **Invoices:** Use five summary cards, a needs-attention list, then the ledger and invoice details. Keep overdue status distinct from ordinary violet actions and preserve each invoice's currency in monetary displays.

The shared summary component belongs to the four screens that repeat its label, value, and detail structure. The shared panel surface belongs to Overview, Finances, Projects, and Invoices. Keep page-level CSS responsible for responsive grids and task-specific content.

## Do's and Don'ts

### Do:

- **Do** use the deep violet rail and Ghost/white content layers as the starting point for future screens.
- **Do** keep a clear hierarchy between metric, label, and explanatory text; use tabular figures for money and counts.
- **Do** pair subtle borders with low, violet-tinted shadows on ordinary data panels.
- **Do** preserve visible keyboard focus and reduced-motion behavior present in the updated sections.

### Don't:

- **Don't** carry the older orange accent or dark content background into newly migrated screens as if they were part of this direction.
- **Don't** spread the featured KPI's gradient and stronger shadow across every card.
- **Don't** use overdue or expense colors as decorative accents.
