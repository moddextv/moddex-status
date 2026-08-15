const localTime = {
  init() {
    const stamps = document.querySelectorAll('time[data-timestamp]');
    if (!stamps.length) return;

    for (const stamp of stamps) {
      stamp.textContent = localTime.format(Number(stamp.dataset.timestamp));
    }
  },

  format(ms) {
    return new Date(ms).toLocaleString(undefined, {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

const tooltip = {
  init() {
    tooltip.bars = document.querySelectorAll('.bar[data-detail]');
    if (!tooltip.bars.length) return;

    tooltip.node = document.createElement('div');
    tooltip.node.className = 'tooltip';
    tooltip.node.setAttribute('role', 'tooltip');
    tooltip.node.hidden = true;
    document.body.append(tooltip.node);
    tooltip.current = null;

    document.addEventListener('pointerover', tooltip.onPointerOver);
    document.addEventListener('pointerout', tooltip.onPointerOut);
    document.addEventListener('pointerdown', tooltip.onPointerDown);
    document.addEventListener('keydown', tooltip.onKeyDown);
    window.addEventListener('scroll', tooltip.hide, { passive: true });
    window.addEventListener('resize', tooltip.hide);

    for (const bar of tooltip.bars) {
      bar.removeAttribute('title');
    }
  },

  barFrom(event) {
    return event.target?.closest?.('.bar[data-detail]') ?? null;
  },

  onPointerOver(event) {
    if (event.pointerType === 'touch') return;

    const bar = tooltip.barFrom(event);
    if (bar) tooltip.show(bar);
  },

  onPointerOut(event) {
    if (event.pointerType === 'touch') return;
    if (tooltip.barFrom(event)) tooltip.hide();
  },

  onPointerDown(event) {
    const bar = tooltip.barFrom(event);
    if (!bar) {
      tooltip.hide();
      return;
    }

    tooltip.show(bar);
    event.preventDefault();
  },

  onKeyDown(event) {
    if (event.key === 'Escape') tooltip.hide();
  },

  show(bar) {
    if (tooltip.current === bar) return;

    tooltip.hide();
    tooltip.current = bar;
    bar.classList.add('is-lit');
    tooltip.node.textContent = `${localTime.format(Number(bar.dataset.timestamp))}\n${bar.dataset.detail}`;
    tooltip.node.hidden = false;
    tooltip.place(bar);
  },

  place(bar) {
    const anchor = bar.getBoundingClientRect();
    const box = tooltip.node.getBoundingClientRect();
    const edge = document.documentElement.clientWidth;
    const left = anchor.left + anchor.width / 2 - box.width / 2;
    const above = anchor.top - box.height - 8;

    tooltip.node.style.left = `${Math.max(8, Math.min(left, edge - box.width - 8)) + window.scrollX}px`;
    tooltip.node.style.top = `${(above < 8 ? anchor.bottom + 8 : above) + window.scrollY}px`;
  },

  hide() {
    if (tooltip.current) tooltip.current.classList.remove('is-lit');
    tooltip.current = null;
    tooltip.node.hidden = true;
  }
};

const theme = {
  key: 'moddex-status-theme',

  init() {
    theme.button = document.getElementById('theme-toggle');
    if (!theme.button) return;

    theme.button.addEventListener('click', theme.onClick);
  },

  onClick() {
    const current = document.documentElement.dataset.theme;
    const showing =
      current || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = showing === 'dark' ? 'light' : 'dark';

    document.documentElement.dataset.theme = next;

    try {
      localStorage.setItem(theme.key, next);
    } catch {}
  }
};

localTime.init();
tooltip.init();
theme.init();
