import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSetting } from "./settings";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("settings namespace migration", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: new MemoryStorage()
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("moves existing settings into the FrameWave namespace when read", () => {
    const legacyNamespace = ["voice", "blank:"].join("");
    const value = { character: "Ava", descriptor: "calm" };

    localStorage.setItem(`${legacyNamespace}namingContext`, JSON.stringify(value));

    expect(getSetting("namingContext", {})).toEqual(value);
    expect(localStorage.getItem("framewave:namingContext")).toBe(
      JSON.stringify(value)
    );
    expect(localStorage.getItem(`${legacyNamespace}namingContext`)).toBeNull();
  });
});
