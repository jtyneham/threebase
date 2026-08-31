import './styles/global.css';
import { playgroundEntries, objectEntries } from './content/catalog.js';
import { initCollectionNavigation } from './ui/collection-navigation.js';
import { renderCollections } from './ui/render-collections.js';

export function initSiteShell() {
  renderCollections({ playgroundEntries, objectEntries });
  return initCollectionNavigation({ playgroundEntries, objectEntries });
}
