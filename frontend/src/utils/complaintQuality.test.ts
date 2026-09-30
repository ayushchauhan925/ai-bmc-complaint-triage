import { describe, expect, test } from 'vitest';
import { assessQuality } from './complaintQuality';
import { dictionaries } from '../i18n/dictionaries';

const en = (keys: string[]) => keys.map((k) => dictionaries.en[k]).join(' ');

const base = { description: '', address: '', hasLocation: false, photoCount: 0 };

describe('assessQuality', () => {
  test('an empty draft is LOW and suggests the essentials without blaming the citizen', () => {
    const r = assessQuality(base);
    expect(r.level).toBe('LOW');
    expect(en(r.suggestions)).toMatch(/pin the location/i);
    expect(en(r.suggestions)).toMatch(/photo/i);
    expect(en(r.suggestions)).not.toMatch(/you (forgot|failed|did not)/i);
  });

  test('a detailed, located, photographed complaint is GREAT with nothing left to suggest', () => {
    const r = assessQuality({
      description: 'There is a large pothole in the middle of the road outside the school gate, present for two weeks and children are at risk of falling.',
      address: 'Opposite City School, Andheri West',
      hasLocation: true,
      photoCount: 2,
    });
    expect(r.level).toBe('GREAT');
    expect(r.suggestions).toEqual([]);
  });

  test('a located but thin complaint asks for the landmark (the "exact location" hint)', () => {
    const r = assessQuality({ description: 'Garbage pile near the bus stop for days', address: '', hasLocation: true, photoCount: 0 });
    expect(r.suggestions).toContain('quality.s.landmark');
    expect(en(r.suggestions)).toMatch(/exact location or a nearby landmark/i);
  });

  test('impact words in Hinglish and Devanagari are recognised', () => {
    const hinglish = assessQuality({ ...base, description: 'Rasta me bahut bada gadda hai kai din se, bachche girte hain' });
    const devanagari = assessQuality({ ...base, description: 'रस्त्यावर मोठा खड्डा आहे अनेक दिवस झाले आहे' });
    expect(hinglish.suggestions).not.toContain('quality.s.impact');
    expect(devanagari.suggestions).not.toContain('quality.s.impact');
  });

  test('score is monotonic: adding detail, landmark or a photo never lowers it', () => {
    const a = assessQuality({ ...base, description: 'pothole on road', hasLocation: true });
    const b = assessQuality({ ...base, description: 'pothole on road', hasLocation: true, address: 'Near the station' });
    const c = assessQuality({ ...base, description: 'pothole on road', hasLocation: true, address: 'Near the station', photoCount: 1 });
    expect(b.score).toBeGreaterThanOrEqual(a.score);
    expect(c.score).toBeGreaterThanOrEqual(b.score);
    expect(c.score).toBeLessThanOrEqual(100);
  });
});
