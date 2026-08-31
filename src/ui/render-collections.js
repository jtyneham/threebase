function createEntry(entry) {
  const article = document.createElement('article');
  article.className = 'entry-card';
  article.id = entry.id;

  const label = document.createElement('p');
  label.className = 'entry-card__label';
  label.textContent = entry.label;

  const title = document.createElement('h3');
  title.textContent = entry.title;

  const description = document.createElement('p');
  description.textContent = entry.description;

  article.append(label, title, description);

  if (entry.href) {
    const link = document.createElement('a');
    link.href = entry.href;
    link.textContent = entry.actionLabel ?? 'Open project';
    link.setAttribute('aria-label', `Open ${entry.title}`);
    article.append(link);
  }

  return article;
}

function createEmptyState(message) {
  const state = document.createElement('div');
  state.className = 'empty-state';
  const text = document.createElement('p');
  text.textContent = message;
  state.append(text);
  return state;
}

function renderList(container, entries, emptyMessage) {
  if (!container) return;
  container.replaceChildren(
    ...(entries.length ? entries.map(createEntry) : [createEmptyState(emptyMessage)]),
  );
}

export function renderCollections({ playgroundEntries, objectEntries }) {
  renderList(
    document.querySelector('[data-playground-list]'),
    playgroundEntries,
    'The first playground project will appear here.',
  );
  renderList(
    document.querySelector('[data-object-list]'),
    objectEntries,
    'The first reconstructed object will appear here.',
  );
}
