const root = document.documentElement;

type Theme = 'light' | 'dark';

const themeToggles = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
const currentTheme = (): Theme => (root.dataset.theme === 'light' ? 'light' : 'dark');

function syncThemeToggles() {
  const isDark = currentTheme() === 'dark';
  themeToggles.forEach((button) => button.setAttribute('aria-checked', String(isDark)));
  // La barra del navegador en móvil sigue el tema elegido, no solo el del sistema
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute('content', isDark ? '#0b1012' : '#f1f5f3'));
}

themeToggles.forEach((button) =>
  button.addEventListener('click', () => {
    const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Sin almacenamiento disponible: el tema solo dura esta visita
    }
    syncThemeToggles();
  }),
);

syncThemeToggles();
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('theme-ready')));
