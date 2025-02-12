import { Part } from "./part";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const LB = textEncoder.encode("\r\n");
const DLB = textEncoder.encode("\r\n\r\n");

type IterableReadableStream<T> = ReadableStream<T> & AsyncIterable<T>;

/**
 * Streams the parts of a multipart/mixed or multipart/form-data body.
 *
 * @param bodyOrContainer - A request, response, or readable stream.
 * @param boundary - The boundary string. If not provided, the boundary will be
 *   extracted from the `Content-Type` header of the request or response.
 * @returns An iterable readable stream of parts.
 */
export function streamParts(
  bodyOrContainer: Request | Response | ReadableStream<Uint8Array | string>,
  boundary?: string
): IterableReadableStream<Part> {
  let body: ReadableStream<Uint8Array | string> | undefined;
  if (
    bodyOrContainer instanceof Request ||
    bodyOrContainer instanceof Response
  ) {
    boundary ??= bodyOrContainer.headers
      .get("content-type")
      ?.match(/boundary="([^"]+)"/)?.[1]!;
    body = bodyOrContainer.body!;
  } else {
    body = bodyOrContainer;
  }
  const b = textEncoder.encode(`--${boundary}\r\n`);
  const end = textEncoder.encode(`--${boundary}--`);
  let headers: Headers | undefined;
  let partWriter: WritableStreamDefaultWriter<Uint8Array> | undefined;
  let margin: Uint8Array | undefined;

  const stream = new TransformStream<Uint8Array | string, Part>({
    async transform(chunk, controller) {
      let bidx = 0;
      if (typeof chunk === "string") chunk = textEncoder.encode(chunk);
      if (margin) {
        chunk = concat(margin, chunk);
        margin = undefined;
      }

      // Find all boundaries in current chunk
      while ((bidx = indexOf(chunk, b)) > -1) {
        const headersEnd = indexOf(chunk, DLB, bidx);
        if (partWriter) {
          // Current part is complete
          if (bidx > LB.length) {
            // don't write the trailing line break
            partWriter.write(chunk.slice(0, bidx - LB.length));
          }
          partWriter.close();
          partWriter = undefined;
        }
        if (headersEnd === -1) {
          // If headers incomplete, don't process this chunk yet
          margin = chunk;
          return;
        }
        headers = parseHeaders(chunk.slice(bidx + b.length, headersEnd));
        const { readable, writable } = new TransformStream();
        partWriter = writable.getWriter();
        controller.enqueue(new Part(readable, headers));
        chunk = chunk.slice(headersEnd + DLB.length);
        bidx = 0;
      }

      const endIdx = indexOf(chunk, end, -end.length);
      if (endIdx > -1) {
        // This is the last chunk / part, write without end boundary and line break
        if (endIdx > LB.length) {
          partWriter?.write(chunk.slice(0, endIdx - LB.length));
        }
        return;
      }
      // Boundary could be split across chunks, so we keep the tail of the chunk
      if (chunk.length >= b.length + LB.length) {
        partWriter?.write(chunk.slice(0, -b.length - 1));
        margin = chunk.slice(-b.length - 1);
        return;
      }
      margin = chunk;
    },
    flush() {
      partWriter?.close();
    },
  });
  return body.pipeThrough(stream) as IterableReadableStream<Part>;
}

function concat(
  chunk1: Uint8Array<ArrayBufferLike>,
  chunk2: Uint8Array<ArrayBufferLike>
) {
  const arr = new Uint8Array(chunk1.length + chunk2.length);
  arr.set(chunk1);
  arr.set(chunk2, chunk1.length);
  return arr;
}

function indexOf(data: Uint8Array, sub: Uint8Array, startAt = 0) {
  for (let i = startAt; i < data.length; i++) {
    for (let j = 0; j < sub.length; j++) {
      if (data[i + j] !== sub[j]) break;
      if (j === sub.length - 1) return i;
    }
  }
  return -1;
}

function parseHeaders(data: Uint8Array) {
  return new Headers(
    textDecoder
      .decode(data)
      .split("\r\n")
      .map((line) => line.split(": ") as [string, string])
  );
}
