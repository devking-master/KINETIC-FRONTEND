/**
 * UpNextQueue: first in, first out. This is the "Add to queue" line: songs a listener adds
 * play before the playlist carries on, in the order they were added.
 *
 * Singly linked list with a front and a back pointer, so enqueue and dequeue are both O(1).
 */
class QueueNode<T> {
  item: T;
  next: QueueNode<T> | null = null;

  constructor(item: T) {
    this.item = item;
  }
}

export class UpNextQueue<T> {
  private front: QueueNode<T> | null = null;
  private back: QueueNode<T> | null = null;
  private length = 0;

  // enqueue(item): O(1)
  enqueue(item: T): void {
    const node = new QueueNode(item);
    if (this.isEmpty()) {
      this.front = node;
      this.back = node;
    } else {
      (this.back as QueueNode<T>).next = node;
      this.back = node;
    }
    this.length++;
  }

  // dequeue(): O(1)
  dequeue(): T | undefined {
    if (this.front === null) return undefined;
    const removed = this.front;
    this.front = removed.next;
    this.length--;
    if (this.length === 0) {
      this.back = null;
    }
    return removed.item;
  }

  // peek(): O(1)
  peek(): T | undefined {
    if (this.front === null) return undefined;
    return this.front.item;
  }

  // size(): O(1)
  size(): number {
    return this.length;
  }

  // isEmpty(): O(1)
  isEmpty(): boolean {
    return this.length === 0;
  }

  // clear(): O(1)
  clear(): void {
    this.front = null;
    this.back = null;
    this.length = 0;
  }

  // removeWhere(test): O(n). Lets a listener take one song back out of the line.
  removeWhere(test: (item: T) => boolean): number {
    let removed = 0;
    let previous: QueueNode<T> | null = null;
    let current = this.front;
    while (current !== null) {
      const following: QueueNode<T> | null = current.next;
      if (test(current.item)) {
        if (previous === null) {
          this.front = following;
        } else {
          previous.next = following;
        }
        if (current === this.back) {
          this.back = previous;
        }
        this.length--;
        removed++;
      } else {
        previous = current;
      }
      current = following;
    }
    return removed;
  }

  // toArray(): O(n). For display only, front of the line first.
  toArray(): T[] {
    const out: T[] = [];
    let written = 0;
    let current = this.front;
    while (current !== null) {
      out[written] = current.item;
      written++;
      current = current.next;
    }
    return out;
  }
}
