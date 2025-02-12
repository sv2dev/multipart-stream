# @sv2dev/multipart-stream

A utility to process multipart/form-data and multipart/mixed bodies.

[![bundle size](https://badgen.net/bundlephobia/minzip/@sv2dev/multipart-stream)](https://bundlephobia.com/package/@sv2dev/multipart-stream)

## Usage

```ts
import { streamParts } from "@sv2dev/multipart-stream";

for await (const part of streamParts(responseOrRequest)) {
  if (part.type === "application/json") {
    console.log(await part.json());
  } else if (part.type === "text/plain") {
    console.log(await part.text());
  } else if (part.filename) {
    // Example for bun:
    Bun.write(part.filename, new Response(part.stream()));
  }
}
```

You can also collect the parts in an array:

```ts
const parts = await Array.fromAsync(streamParts(responseOrRequest));
```

But this makes the whole body being loaded into memory and might not be what
you want.

Note: `streamParts()` returns a `ReadableStream`. In some environments,
`ReadableStream`s are not iterable.

The API is not yet stable and maybe, we should switch to async iterators, instead.
