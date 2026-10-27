/**
 * HistoryStack: last in, first out. Every song that starts playing is pushed on top, so
 * the top of the stack is always "what was playing most recently" and popping goes back in time.
 *
 * Same idea as the Spotify Lite coursework: no native array methods, items live in an
 * index keyed object and `count` tracks the size.
 */
export class HistoryStack<T> {
  private data: Record<number, T> = {};
  private count = 0;
  private readonly capacity: number;

  // `capacity` stops the log growing forever in a long listening session (oldest entry is dropped).
  constructor(capacity: number = 500) {
    this.capacity = capacity > 0 ? capacity : 500;
  }

  // push(item): O(1). Only when the log is full it shifts once, O(capacity), to drop the oldest entry.
  push(item: T): void {
    if (this.count === this.capacity) {
      for (let i = 0; i < this.count - 1; i++) {
        this.data[i] = this.data[i + 1];
      }
      delete this.data[this.count - 1];
      this.count--;
    }
    this.data[this.count] = item;
    this.count++;
  }

  // pop(): O(1)
  pop(): T | undefined {
    if (this.count === 0) return undefined;
    const topIndex = this.count - 1;
    const popped = this.data[topIndex];
    delete this.data[topIndex];
    this.count--;
    return popped;
  }

  // peek(): O(1)
  peek(): T | undefined {
    if (this.count === 0) return undefined;
    return this.data[this.count - 1];
  }

  // size(): O(1)
  size(): number {
    return this.count;
  }

  // isEmpty(): O(1)
  isEmpty(): boolean {
    return this.count === 0;
  }

  // clear(): O(1)
  clear(): void {
    this.data = {};
    this.count = 0;
  }

  // toArrayRecentFirst(limit): O(limit). For display only, newest entry first.
  toArrayRecentFirst(limit: number = this.count): T[] {
    const out: T[] = [];
    let written = 0;
    for (let i = this.count - 1; i >= 0 && written < limit; i--) {
      out[written] = this.data[i];
      written++;
    }
    return out;
  }
}
