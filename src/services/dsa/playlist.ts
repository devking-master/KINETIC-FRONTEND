/**
 * Playlist: a singly linked list of songs (the "source" list the player loads from).
 * shuffle() is Fisher-Yates, so every song ends up exactly once in a fair random order.
 */
class PlaylistNode<T> {
  item: T;
  next: PlaylistNode<T> | null = null;

  constructor(item: T) {
    this.item = item;
  }
}

export class Playlist<T> {
  private head: PlaylistNode<T> | null = null;
  private tail: PlaylistNode<T> | null = null;
  private length = 0;

  // size(): O(1)
  size(): number {
    return this.length;
  }

  // addSong(item): O(1), adds at the end
  addSong(item: T): void {
    const node = new PlaylistNode(item);
    if (this.tail === null) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.length++;
  }

  // addFirst(item): O(1)
  addFirst(item: T): void {
    const node = new PlaylistNode(item);
    if (this.head === null) {
      this.head = node;
      this.tail = node;
    } else {
      node.next = this.head;
      this.head = node;
    }
    this.length++;
  }

  // removeFirst(): O(1)
  removeFirst(): T | undefined {
    if (this.head === null) return undefined;
    const removed = this.head;
    this.head = removed.next;
    this.length--;
    if (this.length === 0) {
      this.tail = null;
    }
    return removed.item;
  }

  // removeLast(): O(n), a singly linked list has to walk to the second last node
  removeLast(): T | undefined {
    if (this.head === null || this.tail === null) return undefined;
    const removed = this.tail;
    if (this.head === this.tail) {
      this.head = null;
      this.tail = null;
      this.length = 0;
      return removed.item;
    }
    let current = this.head;
    while (current.next !== this.tail) {
      current = current.next as PlaylistNode<T>;
    }
    current.next = null;
    this.tail = current;
    this.length--;
    return removed.item;
  }

  // shuffle(): O(n), Fisher-Yates. `random` can be injected so tests are repeatable.
  shuffle(random: () => number = Math.random): void {
    if (this.length <= 1) return;

    const nodes: PlaylistNode<T>[] = [];
    let written = 0;
    let current = this.head;
    while (current !== null) {
      nodes[written] = current;
      written++;
      current = current.next;
    }

    for (let i = written - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const swap = nodes[i];
      nodes[i] = nodes[j];
      nodes[j] = swap;
    }

    this.head = nodes[0];
    for (let i = 0; i < written - 1; i++) {
      nodes[i].next = nodes[i + 1];
    }
    this.tail = nodes[written - 1];
    this.tail.next = null;
  }

  // toArray(): O(n)
  toArray(): T[] {
    const out: T[] = [];
    let written = 0;
    let current = this.head;
    while (current !== null) {
      out[written] = current.item;
      written++;
      current = current.next;
    }
    return out;
  }
}
