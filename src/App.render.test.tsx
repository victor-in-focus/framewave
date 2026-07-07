import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App first render (no source loaded)", () => {
  it("presents the landing story instead of dead tool chrome", () => {
    const html = renderToString(<App />);

    expect(html).toContain("Voice references, stripped to signal.");
    expect(html).toContain("Processed locally");
    expect(html).toContain("Drop in a clip");
    expect(html).toContain("Export a blank MP4");
  });

  it("hides trim, naming, and batch controls until media is loaded", () => {
    const html = renderToString(<App />);

    expect(html).not.toContain("Name This Clip");
    expect(html).not.toContain("Export This Clip");
    expect(html).not.toContain("Batch · No clips");
    expect(html).not.toContain("trim-rail");
    expect(html).not.toContain("Select a range longer than 0 seconds");
  });

  it("invites either video or audio input for blank reference creation", () => {
    const html = renderToString(<App />);

    expect(html).toContain("Drop video or audio here");
    expect(html).toContain("MP4, MOV, WEBM, MP3, WAV, M4A");
    expect(html).toContain("audio/mpeg");
  });

  it("renders create and references together as one workspace", () => {
    const html = renderToString(<App />);

    expect(html).toContain("Create Reference");
    expect(html).toContain("References");
  });

  it("keeps reference controls minimal on first render", () => {
    const html = renderToString(<App />);

    expect(html).toContain("Search references...");
    expect(html).toContain("Add Existing Clip");
    expect(html).toContain("Export All");
    expect(html).toContain("Latest");
    expect(html).toContain("Starred");
  });
});
