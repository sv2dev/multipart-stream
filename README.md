# @sv2dev/multipart-stream

A utility to process multipart/form-data and multipart/mixed bodies.

[![bundle size](https://badgen.net/bundlephobia/minzip/@sv2dev/multipart-stream)](https://bundlephobia.com/package/@sv2dev/multipart-stream)

## Usage

```ts
import { streamParts, iterableToStream } from "@sv2dev/multipart-stream";

for await (const part of streamParts(responseOrRequest)) {
  if (part.type === "application/json") {
    console.log(await part.json());
  } else if (part.type === "text/plain") {
    console.log(await part.text());
  } else if (part.filename) {
    // Example for bun:
    const file = Bun.file(part.filename);
    const writer = file.writer();
    for await (const chunk of part) {
      await writer.write(chunk);
    }
    await writer.close();
  }
}
```

The `streamParts()` function returns an `AsyncIterable<Part>`. The `Part` class
is similar to a `Blob`.

The streaming is designed to iterate over the parts and their bodies as they
are received. If you don't process the body of a part while streaming, it
will be skipped.

For example, if you use the `Array.fromAsync()` function to collect the parts,
the body of each part will be neglected:

```ts
const [firstPart] = await Array.fromAsync(streamParts(responseOrRequest));

console.log(firstPart.type); // "application/json"
console.log(await firstPart.json()); // ERROR: The body is empty
```
