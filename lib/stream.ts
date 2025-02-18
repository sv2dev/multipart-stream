export function iterableToStream<T>(
  iterable: AsyncIterable<T>
): ReadableStream<T> {
  let iterator: AsyncIterator<T>;

  return new ReadableStream({
    async start() {
      iterator = iterable[Symbol.asyncIterator]();
    },
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      if (iterator && typeof iterator.return === "function") {
        await iterator.return();
      }
    },
  });
}
