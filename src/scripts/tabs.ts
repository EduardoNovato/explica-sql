/* Pestañas PostgreSQL | Oracle del paso 1: flechas para moverse y la elección se recuerda */
const STORAGE_KEY = 'engine';

document.querySelectorAll<HTMLElement>('[data-tabs]').forEach((root) => {
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));

  const select = (tab: HTMLButtonElement, focus: boolean) => {
    for (const other of tabs) {
      const selected = other === tab;
      other.setAttribute('aria-selected', String(selected));
      other.tabIndex = selected ? 0 : -1;
      document.getElementById(other.getAttribute('aria-controls') ?? '')?.toggleAttribute('hidden', !selected);
    }
    if (focus) tab.focus();
    try {
      localStorage.setItem(STORAGE_KEY, tab.dataset.engine ?? '');
    } catch {
      // Sin almacenamiento disponible: la elección solo dura esta visita
    }
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab, false));
    tab.addEventListener('keydown', (event) => {
      const moves: Record<string, number> = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      const target = moves[event.key];
      if (target === undefined) return;
      event.preventDefault();
      const next = tabs[(target + tabs.length) % tabs.length];
      if (next) select(next, true);
    });
  });

  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento: queda PostgreSQL
  }
  const initial = tabs.find((tab) => tab.dataset.engine === saved);
  if (initial) select(initial, false);

  // Al analizar un plan, se muestra la pestaña de su motor
  window.addEventListener('explica-sql:dialect', (event) => {
    const engine = (event as CustomEvent<string>).detail;
    const tab = tabs.find((candidate) => candidate.dataset.engine === engine);
    if (tab && tab.getAttribute('aria-selected') !== 'true') select(tab, false);
  });
});
