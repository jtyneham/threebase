function renderMenu(container, entries, emptyLabel, collectionPath) {
  if (!container) return;

  const items = entries.length
    ? entries.map((entry) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `${collectionPath}#${entry.id}`;
        link.textContent = entry.title;
        item.append(link);
        return item;
      })
    : [
        (() => {
          const item = document.createElement('li');
          const text = document.createElement('span');
          text.className = 'nav-menu__empty';
          text.textContent = emptyLabel;
          item.append(text);
          return item;
        })(),
      ];

  container.replaceChildren(...items);
}

export function initCollectionNavigation({ playgroundEntries, objectEntries }) {
  const controller = new AbortController();
  const { signal } = controller;
  const basePath = document.body.dataset.basePath ?? '.';

  renderMenu(
    document.querySelector('[data-playground-menu]'),
    playgroundEntries,
    'No projects yet',
    `${basePath}/playground/`,
  );
  renderMenu(
    document.querySelector('[data-object-menu]'),
    objectEntries,
    'No objects yet',
    `${basePath}/object-lab/`,
  );

  const navigation = document.querySelector('nav[aria-label="Primary navigation"]');
  const items = [...document.querySelectorAll('[data-nav-item]')];
  const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const pinnedItems = new WeakSet();

  function setOpen(item, open, { moveFocus = false } = {}) {
    const trigger = item.querySelector('[data-nav-trigger]');
    const menu = item.querySelector('[data-nav-menu]');
    trigger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;

    if (open) {
      for (const otherItem of items) {
        if (otherItem !== item) setOpen(otherItem, false);
      }
      if (moveFocus) menu.querySelector('a')?.focus();
    } else {
      pinnedItems.delete(item);
    }
  }

  function closeAll() {
    for (const item of items) setOpen(item, false);
  }

  function moveWithinMenu(menu, direction) {
    const links = [...menu.querySelectorAll('a')];
    const currentIndex = links.indexOf(document.activeElement);
    const nextIndex = (currentIndex + direction + links.length) % links.length;
    links[nextIndex]?.focus();
  }

  for (const item of items) {
    const trigger = item.querySelector('[data-nav-trigger]');
    const menu = item.querySelector('[data-nav-menu]');

    trigger.addEventListener(
      'click',
      () => {
        const isOpen = trigger.getAttribute('aria-expanded') === 'true';
        if (isOpen && !pinnedItems.has(item)) {
          pinnedItems.add(item);
        } else {
          setOpen(item, !isOpen);
          if (!isOpen) pinnedItems.add(item);
        }
      },
      { signal },
    );

    trigger.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          pinnedItems.add(item);
          setOpen(item, true, { moveFocus: true });
        } else if (event.key === 'Escape') {
          setOpen(item, false);
        }
      },
      { signal },
    );

    menu.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(item, false);
          trigger.focus();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          moveWithinMenu(menu, event.key === 'ArrowDown' ? 1 : -1);
        }
      },
      { signal },
    );

    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) closeAll();
    }, { signal });

    item.addEventListener('pointerenter', () => {
      if (hoverQuery.matches) setOpen(item, true);
    }, { signal });

    item.addEventListener('pointerleave', () => {
      if (hoverQuery.matches && !pinnedItems.has(item)) setOpen(item, false);
    }, { signal });
  }

  document.addEventListener('pointerdown', (event) => {
    if (!navigation?.contains(event.target)) closeAll();
  }, { signal });

  return () => {
    closeAll();
    controller.abort();
  };
}
