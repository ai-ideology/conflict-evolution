import { describe, expect, test } from "bun:test";
import { createSeededRandom, shuffleWith } from "./random";

describe("可复现随机源", () => {
  test("相同种子产生相同序列", () => {
    const a = createSeededRandom(20260921);
    const b = createSeededRandom(20260921);
    expect(Array.from({ length: 8 }, () => a.next()))
      .toEqual(Array.from({ length: 8 }, () => b.next()));
  });

  test("相同种子产生相同座位排列", () => {
    const a = Array.from({ length: 16 }, (_, index) => index);
    const b = [...a];
    shuffleWith(a, createSeededRandom(7));
    shuffleWith(b, createSeededRandom(7));
    expect(a).toEqual(b);
    expect(a).not.toEqual(Array.from({ length: 16 }, (_, index) => index));
  });
});
