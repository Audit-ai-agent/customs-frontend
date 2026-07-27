export type Child = Node | string | null | undefined | false;

interface ElementOptions {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
  on?: Partial<Record<keyof HTMLElementEventMap, EventListener>>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [name, value] of Object.entries(options.attrs ?? {})) {
    if (name.startsWith("on")) throw new Error("Inline event attributes are forbidden");
    node.setAttribute(name, value);
  }
  for (const [event, listener] of Object.entries(options.on ?? {})) {
    node.addEventListener(event, listener);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

export function button(label: string, onClick: EventListener, variant = "secondary"): HTMLButtonElement {
  return el(
    "button",
    {
      className: `button button--${variant}`,
      text: label,
      attrs: { type: "button" },
      on: { click: onClick },
    },
  );
}

export function badge(label: string, value: string | undefined, tone: string): HTMLElement {
  return el(
    "div",
    { className: `status-badge status-badge--${tone}` },
    el("span", { className: "status-badge__label", text: label }),
    el("strong", { text: humanize(value ?? "not_available") }),
  );
}

/**
 * @deprecated Legacy diagnostic-workbench compatibility only.
 * The commercial experience must use its exhaustive Korean meaning catalogs
 * and the static boundary gate rejects this helper outside src/app.ts/dom.ts.
 */
export function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

export function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export function labeledControl(labelText: string, control: HTMLElement, hint?: string): HTMLElement {
  const id = control.id || crypto.randomUUID();
  control.id = id;
  return el(
    "label",
    { className: "field", attrs: { for: id } },
    el("span", { className: "field__label", text: labelText }),
    control,
    hint ? el("span", { className: "field__hint", text: hint }) : null,
  );
}

export function empty(message: string): HTMLElement {
  return el("p", { className: "empty-state", text: message });
}
