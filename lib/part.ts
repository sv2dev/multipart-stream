const textDecoder = new TextDecoder();

/**
 * A part of a multipart message.
 *
 * It is similar to a `Blob`, but implements the subset of the `Blob` API that
 * makes sense for parts of a multipart message.
 */
export class Part implements AsyncIterable<Uint8Array> {
  /**
   * The type of the part.
   *
   * This is the value of the `Content-Type` header of the part.
   * Technically it can be left out, such that, in contrast to `Blob`, it is
   * nullable.
   */
  get type(): string | null {
    return this.headers.get("content-type");
  }

  /**
   * The size of the part.
   *
   * This is the value of the `Content-Length` header of the part.
   * Technically it can be left out, such that, in contrast to `Blob`, it is
   * nullable.
   */
  get size(): number | null {
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
  get name(): string | null {
    return (
      this.headers.get("content-disposition")?.match(/; name="([^"]+)"/)?.[1] ??
      null
    );
  }

  /**
   * The filename of the part.
   *
   * This is the value of the `Content-Disposition` header of the part.
   * Technically it can be left out, such that, in contrast to `Blob`, it is
   * nullable.
   */
  get filename(): string | null {
    return (
      this.headers
        .get("content-disposition")
        ?.match(/; filename="([^"]+)"/)?.[1] ?? null
    );
  }

  /**
   * [MDN Reference](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator)
   */
  [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    return this.iterable;
  }

  constructor(
    private readonly iterable: AsyncGenerator<Uint8Array>,
    readonly headers: Headers
  ) {}

  /**
   * Consume the part as an array buffer.
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/arrayBuffer)
   */
  async arrayBuffer(): Promise<ArrayBufferLike> {
    return (await this.bytes()).buffer;
  }

  /**
   * Consume the part as bytes.
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/bytes)
   */
  async bytes(): Promise<Uint8Array> {
    return await new Blob(await Array.fromAsync(this)).bytes();
  }

  /**
   * Consume the part as text.
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/text)
   */
  async text(): Promise<string> {
    return textDecoder.decode(await this.bytes());
  }

  /**
   * Consume the part as JSON.
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/json)
   */
  async json(): Promise<unknown> {
    return JSON.parse(await this.text());
  }
}
