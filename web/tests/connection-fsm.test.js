import { describe, it, expect } from 'vitest';
import { States, initialState, reduce, backoffMs } from '../src/core/connection-fsm.js';

describe('States', () => {
  it('exports all expected status strings', () => {
    expect(States.DISCONNECTED).toBe('disconnected');
    expect(States.CONNECTING).toBe('connecting');
    expect(States.CONNECTED).toBe('connected');
    expect(States.STREAMING).toBe('streaming');
    expect(States.STALE).toBe('stale');
    expect(States.RECONNECTING).toBe('reconnecting');
    expect(States.ERROR).toBe('error');
  });
});

describe('initialState', () => {
  it('defaults to DISCONNECTED with autoReconnect true', () => {
    const s = initialState();
    expect(s.status).toBe(States.DISCONNECTED);
    expect(s.attempt).toBe(0);
    expect(s.lastError).toBeNull();
    expect(s.autoReconnect).toBe(true);
    expect(s.lastFrameMs).toBeNull();
  });

  it('accepts autoReconnect=false', () => {
    expect(initialState(false).autoReconnect).toBe(false);
  });
});

describe('reduce', () => {
  it('CONNECT_REQUEST → connecting', () => {
    const s = reduce(initialState(), { type: 'CONNECT_REQUEST' });
    expect(s.status).toBe(States.CONNECTING);
  });

  it('PORT_OPENED → connected and clears lastError', () => {
    const prev = { ...initialState(), status: States.CONNECTING, lastError: new Error('x') };
    const s = reduce(prev, { type: 'PORT_OPENED' });
    expect(s.status).toBe(States.CONNECTED);
    expect(s.lastError).toBeNull();
  });

  it('FRAME → streaming, attempt reset to 0, lastFrameMs set', () => {
    const prev = { ...initialState(), status: States.CONNECTED, attempt: 2 };
    const s = reduce(prev, { type: 'FRAME', atMs: 12345 });
    expect(s.status).toBe(States.STREAMING);
    expect(s.attempt).toBe(0);
    expect(s.lastFrameMs).toBe(12345);
  });

  it('STALE_TICK from streaming → stale', () => {
    const prev = { ...initialState(), status: States.STREAMING };
    const s = reduce(prev, { type: 'STALE_TICK' });
    expect(s.status).toBe(States.STALE);
  });

  it('STALE_TICK from connected → stale', () => {
    const prev = { ...initialState(), status: States.CONNECTED };
    const s = reduce(prev, { type: 'STALE_TICK' });
    expect(s.status).toBe(States.STALE);
  });

  it('STALE_TICK from disconnected → unchanged', () => {
    const prev = initialState();
    const s = reduce(prev, { type: 'STALE_TICK' });
    expect(s.status).toBe(States.DISCONNECTED);
  });

  it('FRAME from stale → streaming', () => {
    const prev = { ...initialState(), status: States.STALE };
    const s = reduce(prev, { type: 'FRAME', atMs: 99 });
    expect(s.status).toBe(States.STREAMING);
    expect(s.lastFrameMs).toBe(99);
  });

  it('STREAM_ENDED with autoReconnect true → reconnecting, attempt incremented', () => {
    const prev = { ...initialState(true), status: States.STREAMING, attempt: 1 };
    const s = reduce(prev, { type: 'STREAM_ENDED' });
    expect(s.status).toBe(States.RECONNECTING);
    expect(s.attempt).toBe(2);
  });

  it('STREAM_ENDED with autoReconnect false → disconnected, attempt 0', () => {
    const prev = { ...initialState(false), status: States.STREAMING, attempt: 1 };
    const s = reduce(prev, { type: 'STREAM_ENDED' });
    expect(s.status).toBe(States.DISCONNECTED);
    expect(s.attempt).toBe(0);
  });

  it('ERROR with autoReconnect → reconnecting & lastError set', () => {
    const err = new Error('port closed');
    const prev = { ...initialState(true), status: States.CONNECTED, attempt: 0 };
    const s = reduce(prev, { type: 'ERROR', error: err });
    expect(s.status).toBe(States.RECONNECTING);
    expect(s.lastError).toBe(err);
    expect(s.attempt).toBe(1);
  });

  it('ERROR without autoReconnect → error status & lastError set', () => {
    const err = new Error('fatal');
    const prev = { ...initialState(false), status: States.CONNECTED };
    const s = reduce(prev, { type: 'ERROR', error: err });
    expect(s.status).toBe(States.ERROR);
    expect(s.lastError).toBe(err);
  });

  it('RECONNECT_TICK → connecting', () => {
    const prev = { ...initialState(), status: States.RECONNECTING };
    const s = reduce(prev, { type: 'RECONNECT_TICK' });
    expect(s.status).toBe(States.CONNECTING);
  });

  it('DISCONNECT_REQUEST → disconnected, attempt 0, lastError null', () => {
    const prev = { ...initialState(), status: States.RECONNECTING, attempt: 3, lastError: new Error('x') };
    const s = reduce(prev, { type: 'DISCONNECT_REQUEST' });
    expect(s.status).toBe(States.DISCONNECTED);
    expect(s.attempt).toBe(0);
    expect(s.lastError).toBeNull();
  });

  it('TOGGLE_AUTO flips autoReconnect and preserves status', () => {
    const prev = { ...initialState(true), status: States.STREAMING };
    const s = reduce(prev, { type: 'TOGGLE_AUTO' });
    expect(s.autoReconnect).toBe(false);
    expect(s.status).toBe(States.STREAMING);

    const s2 = reduce(s, { type: 'TOGGLE_AUTO' });
    expect(s2.autoReconnect).toBe(true);
  });

  it('unknown event type → returns unchanged (new object)', () => {
    const prev = initialState();
    const s = reduce(prev, { type: 'UNKNOWN_EVENT' });
    expect(s).not.toBe(prev); // new object
    expect(s.status).toBe(prev.status);
  });

  it('reduce does NOT mutate input state', () => {
    const prev = Object.freeze({ ...initialState() });
    expect(() => reduce(prev, { type: 'CONNECT_REQUEST' })).not.toThrow();
    expect(prev.status).toBe(States.DISCONNECTED);
  });
});

describe('backoffMs', () => {
  it('attempt 1 → 1000', () => expect(backoffMs(1)).toBe(1000));
  it('attempt 2 → 2000', () => expect(backoffMs(2)).toBe(2000));
  it('attempt 3 → 4000', () => expect(backoffMs(3)).toBe(4000));
  it('attempt 4 → 8000', () => expect(backoffMs(4)).toBe(8000));
  it('attempt 5 → capped at 15000', () => expect(backoffMs(5)).toBe(15000));
  it('attempt 6 → still 15000', () => expect(backoffMs(6)).toBe(15000));
  it('attempt 0 → base', () => expect(backoffMs(0)).toBe(1000));
  it('attempt -1 → base', () => expect(backoffMs(-1)).toBe(1000));
  it('custom base and max', () => {
    expect(backoffMs(1, 500, 3000)).toBe(500);
    expect(backoffMs(3, 500, 3000)).toBe(2000);
    expect(backoffMs(4, 500, 3000)).toBe(3000); // capped
  });
});
