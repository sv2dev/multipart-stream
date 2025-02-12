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

  it("should allow empty body", async () => {
    const body = new Blob([end]).stream();

    const parts = await Array.fromAsync(streamParts(body, boundary));

    expect(parts.length).toBe(0);
  });

  it("should work with a multipart/form-data request", async () => {
    const formData = new FormData();
    formData.append("text", "Hello, world!");
    formData.append(
      "json",
      new Blob([JSON.stringify({ hello: "world" })], {
        type: "application/json",
      })
    );

    const request = new Request("http://localhost:3000", {
      body: formData,
    });

    const [part1, part2] = await Array.fromAsync(streamParts(request));

    expect(part1.type).toBeNull();
    expect(await part1.text()).toEqual("Hello, world!");
    expect(part2.type).toEqual("application/json;charset=utf-8");
    expect(await part2.json()).toEqual({ hello: "world" });
  });

  it("should correctly handle parts split across chunks", async () => {
    const data = textPart + jsonPart + end;
    const body = new ReadableStream({
      start(controller) {
        for (let i = 0; i < data.length; i += 1) {
          controller.enqueue(data.slice(i, i + 1));
        }
        controller.close();
      },
    });

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
