/**
 * Supporting algorithms from Spotify Lite, written without native array methods.
 */

// isPalindrome(str): O(n)
export const isPalindrome = (str: string): boolean => {
  let clean = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i].toLowerCase();
    const isLetterOrDigit = (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9');
    if (isLetterOrDigit) clean += ch;
  }
  let left = 0;
  let right = clean.length - 1;
  while (left < right) {
    if (clean[left] !== clean[right]) return false;
    left++;
    right--;
  }
  return true;
};

// capitalizeTitle(title): O(n). "love nwantiti" -> "Love Nwantiti"
export const capitalizeTitle = (title: string): string => {
  if (!title) return '';
  let out = '';
  let startOfWord = true;
  for (let i = 0; i < title.length; i++) {
    const ch = title[i];
    if (ch === ' ') {
      out += ch;
      startOfWord = true;
    } else {
      out += startOfWord ? ch.toUpperCase() : ch.toLowerCase();
      startOfWord = false;
    }
  }
  return out;
};

// sumDurations(items): O(n), total seconds
export const sumDurations = (items: { duration: number }[]): number => {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].duration || 0;
  }
  return total;
};

// findLongestSong(items): O(n)
export const findLongestSong = <T extends { duration: number }>(items: T[]): T | null => {
  if (items.length === 0) return null;
  let longest = items[0];
  for (let i = 1; i < items.length; i++) {
    if (items[i].duration > longest.duration) longest = items[i];
  }
  return longest;
};
