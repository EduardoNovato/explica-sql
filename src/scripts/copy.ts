/* Botones que copian su data-copy y avisan el resultado en una región aria-live */
document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
  const status = document.getElementById(button.dataset.status ?? '');
  let timer: number | undefined;

  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy ?? '');
      button.dataset.state = 'copied';
      if (status) status.textContent = button.dataset.ok ?? '';
    } catch {
      if (status) status.textContent = button.dataset.error ?? '';
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      button.dataset.state = '';
      if (status) status.textContent = '';
    }, 2400);
  });
});
