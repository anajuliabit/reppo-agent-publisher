export function validateTitle(title: string): void {
  if (title.length < 3) throw new Error('Title must be at least 3 characters');
  if (title.length > 50) throw new Error('Title must be at most 50 characters');
}

export function validateDescription(description: string): void {
  if (description.length < 10) throw new Error('Description must be at least 10 characters');
  if (description.length > 200) throw new Error('Description must be at most 200 characters');
}

export function validateBody(body: string): void {
  if (!body || body.trim().length === 0) throw new Error('Body cannot be empty');
}
