import { describe, expect, it } from 'vitest';
import type { Profile, Settings } from '../types/common.ts';
import type { ChecklistTick } from '../types/core.ts';
import { createMemoryStore, createMmkvStore, createStore, readOr } from './store.ts';

const settings: Settings = {
  language: 'tl',
  lowBatteryThreshold: 15,
  aiEnabled: true,
  staleWarningHours: 3,
  autoCheckUpdates: true,
  wifiOnly: true,
  topicReportsOptIn: false,
};

const profile: Profile = {
  id: 'p1',
  name: 'Bahay namin',
  ownerId: 'm1',
  people: [
    { id: 'm1', name: 'Ana', relation: 'self', ageGroup: 'adult', needs: [], updatedAt: '2026-10-09T10:00:00+08:00' },
  ],
  petsCount: 0,
  headcount: 1,
  members: [],
  home: [],
  livelihood: [],
  plan: { contacts: [] },
  updatedAt: '2026-10-09T10:00:00+08:00',
};

const tick: ChecklistTick = { ticked: true, updatedAt: '2026-10-09T10:00:00+08:00' };

describe('createMemoryStore', () => {
  it('roundtrips values and reads a fallback for missing keys', () => {
    const store = createMemoryStore();
    expect(store.get('settings')).toBeUndefined();

    store.set('settings', settings);
    expect(store.get('settings')).toEqual(settings);
    expect(readOr(store, 'settings', { ...settings, aiEnabled: false }).aiEnabled).toBe(true);

    expect(readOr(store, 'activeProfileId', null)).toBeNull();
    store.set('activeProfileId', 'p1');
    expect(readOr(store, 'activeProfileId', null)).toBe('p1');
  });

  it('seeds from initial data without sharing the source object', () => {
    const source = { ...settings };
    const store = createMemoryStore({ settings: source });
    source.aiEnabled = false;
    expect(readOr(store, 'settings', settings).aiEnabled).toBe(true);
  });

  it('deep-clones on set and get so stored state cannot be mutated', () => {
    const store = createMemoryStore();
    store.set('profiles', [profile]);

    profile.people[0]!.name = 'Binago pagkatapos ng set';
    expect(store.get('profiles')![0]!.people[0]!.name).toBe('Ana');

    const first = store.get('profiles')!;
    first[0]!.people[0]!.name = 'Mutated';
    first[0]!.plan.contacts.push({ name: 'X', phone: '0917' });
    first.push({ ...profile, id: 'p2' });

    const second = store.get('profiles')!;
    expect(second).toHaveLength(1);
    expect(second[0]!.id).toBe('p1');
    expect(second[0]!.people[0]!.name).toBe('Ana');
    expect(second[0]!.plan.contacts).toEqual([]);
  });

  it('deletes keys', () => {
    const store = createMemoryStore({ activeProfileId: 'p1' });
    expect(store.get('activeProfileId')).toBe('p1');
    store.delete('activeProfileId');
    expect(store.get('activeProfileId')).toBeUndefined();
  });

  it('keeps each checklist:<id> key and fixed keys independent', () => {
    const store = createMemoryStore();
    store.set('checklist:p1', { item1: tick });
    store.set('checklist:p2', { item2: { ticked: false, updatedAt: '2026-10-09T11:00:00+08:00' } });
    store.set('settings', settings);

    expect(store.get('checklist:p1')).toEqual({ item1: tick });
    expect(store.get('checklist:p2')).toEqual({ item2: { ticked: false, updatedAt: '2026-10-09T11:00:00+08:00' } });

    store.delete('checklist:p1');
    expect(store.get('checklist:p1')).toBeUndefined();
    expect(store.get('checklist:p2')).toEqual({ item2: { ticked: false, updatedAt: '2026-10-09T11:00:00+08:00' } });
    expect(store.get('settings')).toEqual(settings);
  });
});

describe('createStore', () => {
  it('falls back to a working memory store when MMKV is unavailable in Node', () => {
    expect(createMmkvStore()).toBeNull();

    const auto = createStore({ backend: 'auto' });
    auto.set('settings', settings);
    expect(auto.get('settings')).toEqual(settings);

    const explicitMemory = createStore({ backend: 'memory' });
    explicitMemory.set('activeProfileId', 'p1');
    expect(explicitMemory.get('activeProfileId')).toBe('p1');
  });
});
