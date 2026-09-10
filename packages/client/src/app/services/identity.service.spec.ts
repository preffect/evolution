import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_ID_STORAGE_KEY } from '@evolution/shared';
import { IdentityService } from './identity.service';

describe('IdentityService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reuses the id already persisted for this browser', () => {
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, 'stored-id');
    expect(TestBed.inject(IdentityService).clientId).toBe('stored-id');
  });

  it('mints and persists an id when none is stored', () => {
    const { clientId } = TestBed.inject(IdentityService);
    expect(clientId.length).toBeGreaterThan(0);
    expect(localStorage.getItem(CLIENT_ID_STORAGE_KEY)).toBe(clientId);
  });

  it('falls back to the time + random shape when randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});
    expect(TestBed.inject(IdentityService).clientId).toMatch(/^c_[0-9a-z]+_[0-9a-z]{1,8}$/);
  });

  it('still produces an id when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(TestBed.inject(IdentityService).clientId.length).toBeGreaterThan(0);
  });
});
