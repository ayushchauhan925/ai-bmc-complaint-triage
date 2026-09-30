import { describe, expect, test } from 'vitest';
import { dictionaries } from './dictionaries';
import { CATEGORIES, COMPLAINT_STATUSES, PRIORITY_LEVELS } from '../utils/constants';

describe('translations', () => {
  const keys = Object.keys(dictionaries.en);

  test.each(['hi', 'mr'] as const)('%s has every UI string the English dictionary has', (lang) => {
    const missing = keys.filter((k) => !dictionaries[lang][k]);
    expect(missing).toEqual([]);
  });

  test.each(['hi', 'mr'] as const)('%s translates every status, priority and category enum', (lang) => {
    const need = [
      ...COMPLAINT_STATUSES.map((s) => `status.${s}`),
      ...PRIORITY_LEVELS.map((p) => `priority.${p}`),
      ...CATEGORIES.map((c) => `category.${c}`),
    ];
    expect(need.filter((k) => !dictionaries[lang][k])).toEqual([]);
  });

  test('placeholders survive translation ({n} etc.)', () => {
    for (const k of keys.filter((x) => dictionaries.en[x].includes('{n}'))) {
      expect(dictionaries.hi[k]).toContain('{n}');
      expect(dictionaries.mr[k]).toContain('{n}');
    }
  });

  test('translations are really translated (Devanagari) for the headline strings', () => {
    for (const k of ['auth.welcomeBack', 'home.report', 'submit.title', 'my.title']) {
      expect(dictionaries.hi[k]).toMatch(/[ऀ-ॿ]/);
      expect(dictionaries.mr[k]).toMatch(/[ऀ-ॿ]/);
    }
  });
});
