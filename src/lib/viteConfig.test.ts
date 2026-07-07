import { describe, expect, it } from "vitest";
import viteConfig from "../../vite.config";

describe("Vite configuration", () => {
  it("does not proxy processing to a backend - the app is fully client-side", () => {
    expect(viteConfig.server?.proxy).toBeUndefined();
  });

  it("keeps ffmpeg.wasm packages out of dependency pre-bundling", () => {
    expect(viteConfig.optimizeDeps?.exclude).toEqual(
      expect.arrayContaining(["@ffmpeg/ffmpeg", "@ffmpeg/util"])
    );
  });
});
