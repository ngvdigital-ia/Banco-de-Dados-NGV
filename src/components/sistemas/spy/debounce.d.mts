export interface Debounced<Args extends unknown[]> {
  (...args: Args): void;
  cancel: () => void;
}

export declare function criarDebounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  ms: number,
): Debounced<Args>;
