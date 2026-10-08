import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDecks, addDeck, removeDeck, toggleInDeck } from '../src/deck-model.mjs';

test('quick launch always exists, localStorage corruption does not crash', () => {
  for (const input of [null, undefined, {}, 0, [], 'garbage']) {
    const decks = normalizeDecks(input);
    assert.equal(decks[0].id, 'quick-launch');
  }
});

test('create decks and pin or unpin actions without changing catalog authority', () => {
  const start = normalizeDecks([]);
  const custom = addDeck(start, 'Research Lab', 'deck-research-lab');
  const pinned = toggleInDeck(custom, 'deck-research-lab', 'catalog-health');
  assert.deepEqual(pinned[1].actionIds, ['catalog-health']);
  const unpinned = toggleInDeck(pinned, 'deck-research-lab', 'catalog-health');
  assert.deepEqual(unpinned[1].actionIds, []);
  assert.equal(removeDeck(custom, 'deck-research-lab').length, 1);
});

test('reject duplicate, empty, invalid identifiers and base deck deletion', () => {
  const start = addDeck([], 'My Deck', 'deck-my-deck');
  assert.throws(() => addDeck(start, 'my deck', 'deck-another'));
  assert.throws(() => addDeck(start, ' ', 'deck-empty'));
  assert.throws(() => addDeck(start, 'Unsafe', '../../outside'));
  assert.throws(() => removeDeck(start, 'quick-launch'));
  assert.throws(() => toggleInDeck(start, 'quick-launch', 'rm -rf'));
});

test('deduplicate and bound imported deck entries', () => {
  const decks = normalizeDecks([
    { id: 'quick-launch', name: 'Injected', actionIds: ['catalog-health', 'catalog-health', '!'] },
    { id: 'deck-one', name: ' One ', actionIds: ['macro-demo'] },
    { id: 'deck-one', name: 'Duplicate', actionIds: ['script-smoke'] },
    { id: 'deck-x', name: '', actionIds: [] },
  ]);
  assert.deepEqual(decks[0].actionIds, ['catalog-health']);
  assert.equal(decks[0].name, 'Quick Launch');
  assert.deepEqual(decks.map(x=>x.id), ['quick-launch', 'deck-one']);
});
