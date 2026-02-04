import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setJsonMode, isJsonMode, outputResult } from '../output.js';

describe('setJsonMode / isJsonMode', () => {
  beforeEach(() => {
    setJsonMode(false);
  });

  it('defaults to false', () => {
    expect(isJsonMode()).toBe(false);
  });

  it('toggles to true', () => {
    setJsonMode(true);
    expect(isJsonMode()).toBe(true);
  });

  it('toggles back to false', () => {
    setJsonMode(true);
    setJsonMode(false);
    expect(isJsonMode()).toBe(false);
  });
});

describe('outputResult', () => {
  beforeEach(() => {
    setJsonMode(false);
  });

  it('outputs JSON when in JSON mode', () => {
    setJsonMode(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    outputResult({ foo: 'bar', count: 1 });
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output).toEqual({ foo: 'bar', count: 1 });
  });

  it('serializes bigints as strings in JSON mode', () => {
    setJsonMode(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    outputResult({ value: 123456789012345678901234567890n });
    expect(spy).toHaveBeenCalledOnce();
    const output = JSON.parse(spy.mock.calls[0][0] as string);
    expect(output.value).toBe('123456789012345678901234567890');
  });

  it('does not output when not in JSON mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    outputResult({ foo: 'bar' });
    expect(spy).not.toHaveBeenCalled();
  });
});
