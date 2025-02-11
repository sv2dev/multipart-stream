import { describe, expect, it } from "bun:test";
import { streamParts } from "./multipart-mixed-stream";

describe("streamParts()", () => {
  it("should yield headers and streams", async () => {
    const body = new Blob([textPart, jsonPart, end]).stream();

    const [part1, part2] = await Array.fromAsync(streamParts(body, boundary));

    expect(part1.type).toEqual("text/plain");
    expect(await part1.text()).toEqual("Hello, world!");
    expect(part2.type).toEqual("application/json");
    expect(await part2.json()).toEqual({ hello: "world" });
  });
});

const boundary = "BOUNDARY";

const textPart = `--${boundary}\r\nContent-Type: text/plain\r\n\r\nHello, world!\r\n`;
const jsonPart = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(
  { hello: "world" }
)}\r\n`;
const end = `--${boundary}--`;
