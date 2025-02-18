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
export async function* streamParts(
  bodyOrContainer: Request | Response | ReadableStream<Uint8Array>,
  boundary?: string
): AsyncGenerator<Part> {
  let src: IterableReadableStream<Uint8Array> | undefined;
  if (
    bodyOrContainer instanceof Request ||
    bodyOrContainer instanceof Response
  ) {
    boundary ??= bodyOrContainer.headers
      .get("content-type")
      ?.match(/boundary="?([^"]+)"?/)?.[1]!;
    src = bodyOrContainer.body! as IterableReadableStream<Uint8Array>;
  } else {
    src = bodyOrContainer as IterableReadableStream<Uint8Array>;
  }
  const b = textEncoder.encode(`--${boundary}\r\n`);
  const end = textEncoder.encode(`\r\n--${boundary}--`);
  let headers: Headers | undefined;
  let buffered: Uint8Array | undefined;

  const reader = src.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    let bidx = 0;
    let chunk = value;
    if (buffered) {
      chunk = concat(buffered, chunk);
      buffered = undefined;
    }

    while ((bidx = indexOf(chunk, b)) > -1) {
      const headersEnd = indexOf(chunk, DLB, bidx);
      if (headersEnd === -1) {
        buffered = chunk;
        break;
      }

      headers = parseHeaders(chunk.slice(bidx + b.length, headersEnd));
      chunk = chunk.slice(headersEnd + DLB.length);
      yield new Part(
        (async function* () {
          while (true) {
            const bidx = indexOf(chunk, b);
            if (bidx > -1) {
              yield chunk.slice(0, bidx - LB.length);
              chunk = chunk.slice(bidx);
              return;
            }
            let endIdx = indexOf(chunk.slice(-end.length - LB.length), end);
            if (endIdx > -1) {
              yield chunk.slice(0, endIdx - end.length - LB.length);
              chunk = new Uint8Array(0);
              return;
            }
            if (chunk.length >= b.length + LB.length) {
              yield chunk.slice(0, -b.length - 1);
              chunk = chunk.slice(-b.length - 1);
            }
            const { value, done } = await reader.read();
            if (done) throw new Error("Unexpected end of stream");
            chunk = concat(chunk, value);
          }
        })(),
        headers
      );
    }
    buffered = chunk;
  }
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
    data.length > 0
      ? textDecoder
          .decode(data)
          .split("\r\n")
          .map((line) => line.split(": ") as [string, string])
      : undefined
  );
}
