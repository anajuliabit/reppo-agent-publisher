let jsonMode = false;

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

export function outputResult(data: unknown): void {
  if (jsonMode) {
    // In JSON mode, serialize bigints as strings
    console.log(
      JSON.stringify(data, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2),
    );
  }
}
