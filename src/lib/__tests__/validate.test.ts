import { describe, it, expect } from 'vitest';
import { validateTitle, validateDescription, validateBody } from '../validate.js';

describe('validateTitle', () => {
  it('throws when title is too short', () => {
    expect(() => validateTitle('ab')).toThrow('Title must be at least 3 characters');
  });

  it('throws when title is empty', () => {
    expect(() => validateTitle('')).toThrow('Title must be at least 3 characters');
  });

  it('throws when title is too long', () => {
    expect(() => validateTitle('a'.repeat(51))).toThrow('Title must be at most 50 characters');
  });

  it('accepts title at minimum boundary (3 chars)', () => {
    expect(() => validateTitle('Ode')).not.toThrow();
  });

  it('accepts title at maximum boundary (50 chars)', () => {
    expect(() => validateTitle('a'.repeat(50))).not.toThrow();
  });

  it('accepts valid title', () => {
    expect(() => validateTitle('Kitchen at Midnight')).not.toThrow();
  });
});

describe('validateDescription', () => {
  it('throws when description is too short', () => {
    expect(() => validateDescription('short')).toThrow('Description must be at least 10 characters');
  });

  it('throws when description is empty', () => {
    expect(() => validateDescription('')).toThrow('Description must be at least 10 characters');
  });

  it('throws when description is too long', () => {
    expect(() => validateDescription('a'.repeat(201))).toThrow('Description must be at most 200 characters');
  });

  it('accepts description at minimum boundary (10 chars)', () => {
    expect(() => validateDescription('a'.repeat(10))).not.toThrow();
  });

  it('accepts description at maximum boundary (200 chars)', () => {
    expect(() => validateDescription('a'.repeat(200))).not.toThrow();
  });

  it('accepts valid description', () => {
    expect(() => validateDescription('A short poem about late nights and cold rice')).not.toThrow();
  });
});

describe('validateBody', () => {
  it('throws when body is empty string', () => {
    expect(() => validateBody('')).toThrow('Body cannot be empty');
  });

  it('throws when body is whitespace only', () => {
    expect(() => validateBody('   \n\t  ')).toThrow('Body cannot be empty');
  });

  it('accepts valid body', () => {
    expect(() => validateBody('The fridge hums its one note, the faucet drips in 3/4 time.')).not.toThrow();
  });
});
