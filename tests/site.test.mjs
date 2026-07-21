import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [html, css, script, socialPreview] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../script.js", import.meta.url), "utf8"),
  readFile(new URL("../social-preview.jpg", import.meta.url))
]);

function jpegDimensions(buffer) {
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xc3;

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    offset += segmentLength + 2;
  }

  throw new Error("JPEG dimensions not found");
}

test("ships exactly five story controls and five visual scenes", () => {
  assert.equal((html.match(/class="stage-button/g) ?? []).length, 5);
  assert.equal((html.match(/data-scene="[0-4]"/g) ?? []).length, 5);
});

test("every visual scene includes an accessible SVG title and description", () => {
  assert.equal((html.match(/<title id="[^"]+-title">/g) ?? []).length, 5);
  assert.equal((html.match(/<desc id="[^"]+-desc">/g) ?? []).length, 5);
  assert.equal((html.match(/role="img" aria-labelledby=/g) ?? []).length, 5);
});

test("public evidence links use HTTPS and safe new-tab attributes", () => {
  const publicLinks = [...html.matchAll(/<a href="(https:[^"]+)" target="_blank" rel="noreferrer">/g)];
  assert.equal(publicLinks.length, 5);
});

test("medical hype claims are absent", () => {
  const corpus = `${html}\n${script}`.toLowerCase();
  assert.equal(corpus.includes("100% accurate"), false);
  assert.equal(corpus.includes("cure available now"), false);
  assert.equal(corpus.includes("guaranteed cure"), false);
});

test("OSAN design locks are represented", () => {
  assert.match(css, /--ink: #1d1e1f/);
  assert.match(css, /--yellow: #ffdd72/);
  assert.match(css, /--blue: #72c4e4/);
  assert.match(css, /--mint: #80d097/);
  assert.match(css, /--pink: #fcb7bf/);
  assert.match(css, /prefers-reduced-motion/);
});

test("all five stable URL hashes are configured", () => {
  for (const hash of ["problem", "equation", "landscape", "product", "roadmap"]) {
    assert.match(script, new RegExp(`hash: "${hash}"`));
  }
});

test("the primary canvas uses intrinsic proportions instead of tall fixed heights", () => {
  assert.match(css, /aspect-ratio: 12 \/ 7/);
  assert.doesNotMatch(css, /min-height: (?:360|400|500|520|550|620)px/);
  assert.doesNotMatch(css, /width: 112%/);
});

test("the share preview keeps the 1200 by 630 JPEG social-card contract", () => {
  assert.equal(socialPreview.subarray(0, 3).toString("hex"), "ffd8ff");
  assert.deepEqual(jpegDimensions(socialPreview), { width: 1200, height: 630 });
});
