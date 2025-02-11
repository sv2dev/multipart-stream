const textDecoder = new TextDecoder();

/**
 * A part of a multipart message.
 *
 * It is similar to a `Blob`, but implements the subset of the `Blob` API that
 * makes sense for parts of a multipart message.
 */
export class Part {
  /**
   * The type of the part.
   *
   * This is the value of the `Content-Type` header of the part.
   * Technically it can be left out, such that, in contrast to `Blob`, it is
   * nullable.
   */
  get type() {
    return this.headers.get("content-type");
  }

  /**
   * The size of the part.
   *
   * This is the value of the `Content-Length` header of the part.
   * Technically it can be left out, such that, in contrast to `Blob`, it is
   * nullable.
   */
  get size() {
    const contentLength = this.headers.get("content-length");
    return contentLength ? parseInt(contentLength) : null;
  }

  /**
   * The name of the part.
   *
   * This is the value of the `Content-Disposition` header of the part.
   * Technically it can be left out, such that, in contrast to `Blob`, it is
   * nullable.
   */
  get name() {
    return (
      this.headers.get("content-disposition")?.match(/; name="([^"]+)"/)?.[1] ??
      null
    );
  }

  #stream: ReadableStream<Uint8Array<ArrayBufferLike>>;

  constructor(stream: ReadableStream<Uint8Array>, readonly headers: Headers) {
    this.#stream = stream;
  }

  /**
   * Consume the part as an array buffer.
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/arrayBuffer)
   */
  async arrayBuffer() {
    return (await this.bytes()).buffer;
  }

  /**
   * Consume the part as bytes.
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/bytes)
   */
  async bytes() {
    const reader = this.#stream.getReader();
    const buffers: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffers.push(value);
    }
    return await new Blob(buffers).bytes();
  }

  /**
   * Consume the part as text.
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/text)
   */
  async text() {
    return textDecoder.decode(await this.bytes());
  }

  /**
   * Get the stream of the part.
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/stream)
   */
  stream(): ReadableStream<Uint8Array> {
    return this.#stream;
  }

  /**
   * Consume the part as JSON.
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/json)
   */
  async json() {
    return JSON.parse(await this.text());
  }
}
