/**
 * TrackLibrary: the browsable list of songs (port of SongLibrary from Spotify Lite).
 *
 * - sortByDuration(): bubble sort, O(n squared) worst case, O(n) when already in order.
 * - searchByTitle(): linear search, O(n), works on any order.
 * - searchByTitleSorted(): binary search, O(log n), only valid when the list is sorted A to Z.
 *
 * `sortedBy` remembers how the list is ordered, so binary search is never run on a list it
 * cannot trust (it quietly falls back to the linear search instead of returning a wrong answer).
 */
export interface LibraryItem {
  title: string;
  duration: number;
  artist?: string;
}

export type LibraryOrder = 'none' | 'duration' | 'title';

// True when `needle` appears inside `haystack` (both already lower case). No arrays involved.
const textContains = (haystack: string, needle: string): boolean => {
  return haystack.indexOf(needle) !== -1;
};

export class TrackLibrary<T extends LibraryItem> {
  private data: Record<number, T> = {};
  private length = 0;
  private order: LibraryOrder = 'none';

  // size(): O(1)
  size(): number {
    return this.length;
  }

  // sortedBy(): O(1)
  sortedBy(): LibraryOrder {
    return this.order;
  }

  // getAt(index): O(1)
  getAt(index: number): T | undefined {
    if (index < 0 || index >= this.length) return undefined;
    return this.data[index];
  }

  // addSong(item): O(1). Adding breaks any sort order we knew about.
  addSong(item: T): void {
    this.data[this.length] = item;
    this.length++;
    this.order = 'none';
  }

  // addFirst(item): O(n)
  addFirst(item: T): void {
    for (let i = this.length; i > 0; i--) {
      this.data[i] = this.data[i - 1];
    }
    this.data[0] = item;
    this.length++;
    this.order = 'none';
  }

  // removeLast(): O(1)
  removeLast(): T | undefined {
    if (this.length === 0) return undefined;
    const lastIndex = this.length - 1;
    const removed = this.data[lastIndex];
    delete this.data[lastIndex];
    this.length--;
    return removed;
  }

  // removeFirst(): O(n)
  removeFirst(): T | undefined {
    if (this.length === 0) return undefined;
    const removed = this.data[0];
    for (let i = 0; i < this.length - 1; i++) {
      this.data[i] = this.data[i + 1];
    }
    delete this.data[this.length - 1];
    this.length--;
    return removed;
  }

  // sortByDuration(descending): bubble sort. Stable: equal durations keep their order.
  sortByDuration(descending: boolean = false): void {
    const n = this.length;
    for (let i = 0; i < n - 1; i++) {
      let swapped = false;
      for (let j = 0; j < n - i - 1; j++) {
        const left = this.data[j].duration;
        const right = this.data[j + 1].duration;
        const outOfOrder = descending ? left < right : left > right;
        if (outOfOrder) {
          const temp = this.data[j];
          this.data[j] = this.data[j + 1];
          this.data[j + 1] = temp;
          swapped = true;
        }
      }
      if (!swapped) break; // already in order, stop early
    }
    this.order = 'duration';
  }

  // sortByTitleAlphabetical(): bubble sort A to Z, case-insensitive. Needed before binary search.
  sortByTitleAlphabetical(): void {
    const n = this.length;
    for (let i = 0; i < n - 1; i++) {
      let swapped = false;
      for (let j = 0; j < n - i - 1; j++) {
        if (this.data[j].title.toLowerCase() > this.data[j + 1].title.toLowerCase()) {
          const temp = this.data[j];
          this.data[j] = this.data[j + 1];
          this.data[j + 1] = temp;
          swapped = true;
        }
      }
      if (!swapped) break;
    }
    this.order = 'title';
  }

  // searchByTitle(title): linear search, O(n). Exact title, ignores upper/lower case.
  searchByTitle(title: string): T | null {
    const target = title.toLowerCase();
    for (let i = 0; i < this.length; i++) {
      if (this.data[i].title.toLowerCase() === target) {
        return this.data[i];
      }
    }
    return null;
  }

  // searchByTitleSorted(title): binary search, O(log n). Exact title.
  // Only trusted when the list is sorted A to Z; otherwise it uses the linear search.
  searchByTitleSorted(title: string): T | null {
    if (this.order !== 'title') return this.searchByTitle(title);

    const target = title.toLowerCase();
    let low = 0;
    let high = this.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const midTitle = this.data[mid].title.toLowerCase();
      if (midTitle === target) {
        return this.data[mid];
      } else if (midTitle < target) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return null;
  }

  // searchContains(query): O(n). Every song whose title or artist contains the text, in list order.
  searchContains(query: string): T[] {
    const needle = query.trim().toLowerCase();
    const out: T[] = [];
    if (needle === '') return out;
    let written = 0;
    for (let i = 0; i < this.length; i++) {
      const item = this.data[i];
      const inTitle = textContains(item.title.toLowerCase(), needle);
      const inArtist = item.artist ? textContains(item.artist.toLowerCase(), needle) : false;
      if (inTitle || inArtist) {
        out[written] = item;
        written++;
      }
    }
    return out;
  }

  // search(query): the exact title match (found with binary search when the list is sorted A to Z,
  // linear search otherwise) goes first, then every other song containing the text.
  search(query: string): T[] {
    const matches = this.searchContains(query);
    const exact = this.searchByTitleSorted(query.trim());
    if (exact === null) return matches;

    const out: T[] = [];
    out[0] = exact;
    let written = 1;
    for (let i = 0; i < matches.length; i++) {
      if (matches[i] !== exact) {
        out[written] = matches[i];
        written++;
      }
    }
    return out;
  }

  // toArray(): O(n), for rendering
  toArray(): T[] {
    const out: T[] = [];
    for (let i = 0; i < this.length; i++) {
      out[i] = this.data[i];
    }
    return out;
  }
}
