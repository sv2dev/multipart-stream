const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const LB = textEncoder.encode("\r\n");
const DLB = textEncoder.encode("\r\n\r\n");

export function iterateMultipartMixed(
  bodyOrContainer: Request | Response | ReadableStream<Uint8Array>,
  boundary?: string
): ReadableStream<[Headers, ReadableStream<Uint8Array> | Uint8Array]> &
  AsyncIterable<[Headers, ReadableStream<Uint8Array>]> {
  let body: ReadableStream<Uint8Array> | undefined;
  if (
    bodyOrContainer instanceof Request ||
    bodyOrContainer instanceof Response
  ) {
    boundary ??= bodyOrContainer.headers
      .get("content-type")
      ?.split("boundary=")[1]!;
    body = bodyOrContainer.body!;
  } else {
    body = bodyOrContainer;
  }
  const b = textEncoder.encode(`--${boundary}\r\n`);
  const end = textEncoder.encode(`\r\n--${boundary}--`);
  let headers: Headers | undefined;
  let partWriter: WritableStreamDefaultWriter<Uint8Array> | undefined;
  const stream = new TransformStream<
    Uint8Array,
    [Headers, ReadableStream<Uint8Array>]
  >({
    async transform(chunk, controller) {
      let bidx = 0;
      // Find all boundaries in current chunk
      while ((bidx = findSubArray(chunk, b, bidx)) > -1) {
        const headersEnd = findSubArray(chunk, DLB, bidx);
        // If headers incomplete, don't process this chunk
        if (headersEnd === -1) break;
        if (bidx > 0 && partWriter) partWriter.write(chunk.slice(0, bidx - 1));
        headers = parseHeaders(chunk.slice(bidx + b.length, headersEnd));
        const { readable, writable } = new TransformStream();
        partWriter = writable.getWriter();
        controller.enqueue([headers, readable]);
        chunk = chunk.slice(headersEnd + DLB.length);
        bidx = 0;
      }
      // No more boundaries in current chunk, write remaining data to part stream
      if (chunk.length > 0) partWriter!.write(chunk);
    },
  });
  return body!.pipeThrough(stream) as ReadableStream<
    [Headers, ReadableStream<Uint8Array> | Uint8Array]
  > &
    AsyncIterable<[Headers, ReadableStream<Uint8Array>]>;
}

function findSubArray(data: Uint8Array, sub: Uint8Array, startAt = 0) {
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
