import { describe, expect, it } from "bun:test";
import { iterateMultipartMixed } from "./multipart-mixed-stream";

describe("iterateMultipartMixed", () => {
  it("should yield headers and streams", async () => {
    const body = new Blob([createChunk([textPart, jsonPart, end])]).stream();

    const parts = await Array.fromAsync(iterateMultipartMixed(body, boundary));

    expect(parts).toEqual([
      [new Headers({ "content-type": "text/plain" }), new Blob([textPart])],
      [
        new Headers({ "content-type": "application/json" }),
        expect.any(ReadableStream),
      ],
    ]);
  });
});

const boundary = "BOUNDARY";

const textPart = `--${boundary}\r\nContent-Type: text/plain\r\n\r\nHello, world!`;
const jsonPart = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(
  { hello: "world" }
)}`;
const end = `--${boundary}--`;

const encoder = new TextEncoder();

function createChunk(parts: string[]) {
  const chunkText = parts.join("\r\n");
  return encoder.encode(chunkText);
}
