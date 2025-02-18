import { describe, expect, it } from "bun:test";
import { streamParts } from "./multipart-mixed-stream";
import type { Part } from "./part";

describe("streamParts()", () => {
  it("should yield parts", async () => {
    const body = new Blob([textPart, jsonPart, end]).stream();

    const [part1, part2] = await Array.fromAsync(streamParts(body, boundary));

    expect(part1.type).toEqual("text/plain");
    expect(part2.type).toEqual("application/json");
  });

  it("should provide the content of parts, if accessed during streaming", async () => {
    const body = new Blob([textPart, jsonPart, end]).stream();

    const contents: any[] = [];
    for await (const part of streamParts(body, boundary)) {
      contents.push(
        part.type === "text/plain" ? await part.text() : await part.json()
      );
    }

    expect(contents).toEqual(["Hello, world!", { hello: "world" }]);
  });

  it("should allow empty multipart", async () => {
    const body = new Blob([end]).stream();

    const parts = await Array.fromAsync(streamParts(body, boundary));

    expect(parts.length).toBe(0);
  });

  it("should allow streaming to a file", async () => {
    const body = new Blob([textPart, end]).stream();
    const file = Bun.file(".test/test.txt");

    for await (const part of streamParts(body, boundary)) {
      for await (const chunk of part) {
        await file.write(chunk);
      }
    }

    expect(await file.text()).toBe("Hello, world!");
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
    const parts: Part[] = [];
    const contents: any[] = [];

    for await (const part of streamParts(request)) {
      parts.push(part);
      contents.push(part.type === null ? await part.text() : await part.json());
    }

    expect(contents).toEqual(["Hello, world!", { hello: "world" }]);
    expect(parts.length).toBe(2);
    expect(parts[0].name).toBe("text");
    expect(parts[1].name).toBe("json");
  });

  it("should correctly handle parts split across chunks", async () => {
    const data = await new Blob([textPart, jsonPart, end]).bytes();
    const body = new ReadableStream({
      start(controller) {
        for (let i = 0; i < data.length; i += 1) {
          controller.enqueue(data.slice(i, i + 1));
        }
        controller.close();
      },
    });

    const contents: any[] = [];
    for await (const part of streamParts(body, boundary)) {
      contents.push(
        part.type === "text/plain" ? await part.text() : await part.json()
      );
    }

    expect(contents).toEqual(["Hello, world!", { hello: "world" }]);
  });

  it("should continue reading the source stream, if we read the current part", async () => {
    const data = await new Blob([shortTextPart, end]).bytes();
    const body = new ReadableStream({
      start(controller) {
        for (let i = 0; i < data.length; i += 1) {
          controller.enqueue(data.slice(i, i + 1));
        }
        controller.close();
      },
    });

    let text = "";

    for await (const part of streamParts(body, boundary)) {
      text += await part.text();
    }

    expect(text).toEqual("Hello!");
  });
});

const boundary = "BOUNDARY";

const textPart = `--${boundary}\r\nContent-Type: text/plain\r\n\r\nHello, world!\r\n`;
const shortTextPart = `--${boundary}\r\nContent-Type: text/plain\r\n\r\nHello!\r\n`;
const jsonPart = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(
  { hello: "world" }
)}\r\n`;
const end = `--${boundary}--`;
