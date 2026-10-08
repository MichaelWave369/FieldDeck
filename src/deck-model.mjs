/**
 * Personal deck model. Untrusted localStorage data is normalized before display.
 * Deck customization affects the browser only and grants no execution authority.
 */
export const BASE_DECK = Object.freeze({ id: 'quick-launch', name: 'Quick Launch', actionIds: [] });
export const MAX_DECKS = 12;
export const MAX_ACTIONS_PER_DECK = 100;

function safeName(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 36);
}

export function normalizeDecks(value) {
  const out = [{ ...BASE_DECK, actionIds: [] }];
  if (!Array.isArray(value)) return out;
  const ids = new Set([BASE_DECK.id]);
  const names = new Set([BASE_DECK.name.toLowerCase()]);
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const id = raw.id;
    const name = safeName(raw.name);
    const isBase = id === BASE_DECK.id;
    if (!isBase && (typeof id !== 'string' || !/^deck-[a-z0-9-]{1,48}$/.test(id))) continue;
    if (!isBase && (ids.has(id) || !name || names.has(name.toLowerCase()) || out.length > MAX_DECKS)) continue;
    const actionIds = Array.isArray(raw.actionIds)
      ? [...new Set(raw.actionIds.filter(a => typeof a === 'string' && /^[a-z0-9-]{1,60}$/.test(a)))].slice(0, MAX_ACTIONS_PER_DECK)
      : [];
    if (isBase) out[0] = { ...BASE_DECK, actionIds };
    else {
      out.push({ id, name, actionIds });
      ids.add(id);
      names.add(name.toLowerCase());
    }
  }
  return out;
}

export function addDeck(decks, name, id) {
  const current = normalizeDecks(decks);
  const label = safeName(name);
  if (!label || current.length > MAX_DECKS) throw new Error('Deck limit reached or name is empty.');
  if (current.some(d => d.name.toLowerCase() === label.toLowerCase())) throw new Error('That deck already exists.');
  if (typeof id !== 'string' || !/^deck-[a-z0-9-]{1,48}$/.test(id) || current.some(d => d.id === id)) throw new Error('Invalid deck ID.');
  return [...current, { id, name: label, actionIds: [] }];
}

export function toggleInDeck(decks, deckId, actionId) {
  if (typeof actionId !== 'string' || !/^[a-z0-9-]{1,60}$/.test(actionId)) throw new Error('Invalid action ID');
  return normalizeDecks(decks).map(deck => {
    if (deck.id !== deckId) return deck;
    const has = deck.actionIds.includes(actionId);
    const ids = has ? deck.actionIds.filter(id => id !== actionId) : [...deck.actionIds, actionId];
    if (ids.length > MAX_ACTIONS_PER_DECK) throw new Error('Deck is full.');
    return { ...deck, actionIds: ids };
  });
}

export function removeDeck(decks, deckId) {
  if (deckId === BASE_DECK.id) throw new Error('Quick Launch cannot be removed.');
  return normalizeDecks(decks).filter(deck => deck.id !== deckId);
}
