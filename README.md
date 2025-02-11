# @sv2dev/multipart-stream

A utility to process multipart/form-data and multipart/mixed bodies.

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

Note: This is a work in progress and the API is not yet stable.
