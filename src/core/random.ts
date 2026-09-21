/** 可注入的随机源。模拟随机与眨眼、抖动等视觉随机必须分开。 */
export interface RandomSource {
  next(): number;
}

/**
 * 小型、可复现的 mulberry32 随机源。
 * 只用于教学模拟与 A/B 对照，不用于密码学场景。
 */
export function createSeededRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function shuffleWith<T>(items: T[], random: RandomSource): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
}
