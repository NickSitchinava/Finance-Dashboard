const listSelector = ".finance-table, .projects-table, .crm-list, .invoice-table, .goals-list";
const rowSelector = ".finance-table tbody tr, .projects-table tbody tr, .crm-list-row, .invoice-table tbody tr, .goals-list__row";
const panelSelector = ".finance-panel, .projects-collection, .crm-page, .invoice-ledger, .goals-workspace";

/** Adds presentation-only feedback without touching row or action handlers. */
export function mountTableListInteractions() {
  let tooltip: HTMLDivElement | null = null;
  let trigger: HTMLElement | null = null;
  let activePanel: HTMLElement | null = null;
  let activeList: HTMLElement | null = null;
  let activeRow: HTMLElement | null = null;
  const highlights = new WeakMap<HTMLElement, HTMLSpanElement>();

  const hideTooltip = () => {
    tooltip?.remove();
    tooltip = null;
    trigger = null;
  };
  const hideHighlight = () => {
    if (activePanel) highlights.get(activePanel)?.style.setProperty("opacity", "0");
    activePanel = null;
    activeList = null;
    activeRow = null;
  };

  const placeTooltip = () => {
    if (!tooltip || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left + rect.width / 2 - width / 2));
    const above = rect.top - height - 9;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${above >= 8 ? above : rect.bottom + 9}px`;
  };

  const showTooltip = (element: HTMLElement) => {
    if (trigger === element) return;
    hideTooltip();
    const label = element.dataset.tooltip;
    if (!label) return;
    trigger = element;
    tooltip = document.createElement("div");
    tooltip.className = "table-list-tooltip";
    tooltip.textContent = label;
    tooltip.setAttribute("aria-hidden", "true");
    document.body.appendChild(tooltip);
    placeTooltip();
  };

  const findTrigger = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const element = target.closest<HTMLElement>("[data-tooltip]");
    return element?.closest(listSelector) ? element : null;
  };

  const showHighlight = (row: HTMLElement) => {
    const panel = row.closest<HTMLElement>(panelSelector);
    const list = row.closest<HTMLElement>(listSelector);
    const viewport = list?.matches(".crm-list, .goals-list") ? list : list?.parentElement;
    if (!panel || !viewport || !list) return;
    if (activePanel && activePanel !== panel) highlights.get(activePanel)?.style.setProperty("opacity", "0");
    activePanel = panel;
    activeList = list;
    activeRow = row;
    let highlight = highlights.get(panel);
    if (!highlight) {
      highlight = document.createElement("span");
      highlight.className = "table-list-hover";
      highlight.setAttribute("aria-hidden", "true");
      panel.prepend(highlight);
      highlights.set(panel, highlight);
    }
    const rowRect = row.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const visibleLeft = Math.max(rowRect.left, viewportRect.left + viewport.clientLeft);
    const visibleRight = Math.min(rowRect.right, viewportRect.right - viewport.clientLeft);
    highlight.style.height = `${rowRect.height}px`;
    highlight.style.width = `${Math.max(0, visibleRight - visibleLeft)}px`;
    highlight.style.left = `${visibleLeft - panelRect.left - panel.clientLeft}px`;
    highlight.style.transform = `translateY(${rowRect.top - panelRect.top - panel.clientTop}px)`;
    highlight.style.borderRadius = row.nextElementSibling ? "0" : "0 0 9px 9px";
    highlight.style.opacity = "1";
  };

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    if (event.target instanceof Element) {
      const row = event.target.closest<HTMLElement>(rowSelector);
      if (row && !(event.relatedTarget instanceof Node && row.contains(event.relatedTarget))) showHighlight(row);
    }
    const element = findTrigger(event.target);
    if (element) showTooltip(element);
  };
  const onPointerOut = (event: PointerEvent) => {
    if (trigger && event.target instanceof Node && trigger.contains(event.target) &&
        !(event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget))) hideTooltip();
    if (activeList && event.target instanceof Node && activeList.contains(event.target) &&
        !(event.relatedTarget instanceof Node && activeList.contains(event.relatedTarget))) {
      hideHighlight();
    }
  };
  const onFocusIn = (event: FocusEvent) => {
    const element = findTrigger(event.target);
    if (element) showTooltip(element);
  };
  const onFocusOut = (event: FocusEvent) => {
    if (trigger && event.target === trigger) hideTooltip();
  };

  document.addEventListener("pointerover", onPointerOver);
  document.addEventListener("pointerout", onPointerOut);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  window.addEventListener("scroll", () => {
    hideTooltip();
    if (activeRow?.isConnected && activeRow.matches(":hover")) showHighlight(activeRow);
    else hideHighlight();
  }, true);
  window.addEventListener("resize", hideTooltip);
  window.addEventListener("blur", hideTooltip);
}
