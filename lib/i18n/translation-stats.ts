// Helpers for working with translation message trees as flat key→leaf maps.
// Used by the admin Settings page to compute completion % and by the
// phrase-by-phrase editor to render one row per leaf.

export type Leaf = string | number | boolean | null;
export type MessageTree = { [key: string]: MessageTree | Leaf };

function isPlainObject(v: unknown): v is MessageTree {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Walk the message tree, emitting one entry per leaf with a dotted key path.
// Order is depth-first, base-tree-stable so the editor renders consistently
// regardless of how the overlay is shaped.
export function flattenLeaves(tree: MessageTree, prefix = ""): Array<{ key: string; value: Leaf }> {
  const out: Array<{ key: string; value: Leaf }> = [];
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (isPlainObject(v)) {
      out.push(...flattenLeaves(v, path));
    } else {
      out.push({ key: path, value: v as Leaf });
    }
  }
  return out;
}

// Read a leaf value by dotted path. Returns undefined when any segment is
// missing or when the destination is an object rather than a leaf.
export function getLeafByPath(tree: MessageTree, path: string): Leaf | undefined {
  const segments = path.split(".");
  let cursor: MessageTree | Leaf = tree;
  for (const seg of segments) {
    if (!isPlainObject(cursor)) return undefined;
    cursor = (cursor as MessageTree)[seg] as MessageTree | Leaf;
    if (cursor === undefined) return undefined;
  }
  if (isPlainObject(cursor)) return undefined;
  return cursor as Leaf;
}

// Set a leaf at a dotted path, creating intermediate objects as needed.
// Mutates the tree.
export function setLeafByPath(tree: MessageTree, path: string, value: Leaf): void {
  const segments = path.split(".");
  let cursor: MessageTree = tree;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]!;
    const next = cursor[seg];
    if (!isPlainObject(next)) {
      cursor[seg] = {};
    }
    cursor = cursor[seg] as MessageTree;
  }
  cursor[segments[segments.length - 1]!] = value;
}

// Stats for a translated tree relative to a base tree (English):
//   total      — leaf count in the base
//   translated — leaves where the overlay's value differs from the base
//   percent    — translated / total, rounded to nearest integer (0..100)
export function computeTranslationStats(
  base: MessageTree,
  overlay: MessageTree,
): { total: number; translated: number; percent: number } {
  const baseLeaves = flattenLeaves(base);
  let translated = 0;
  for (const { key, value } of baseLeaves) {
    const overlayVal = getLeafByPath(overlay, key);
    if (overlayVal !== undefined && overlayVal !== value) {
      translated++;
    }
  }
  const total = baseLeaves.length;
  const percent = total === 0 ? 0 : Math.round((translated / total) * 100);
  return { total, translated, percent };
}
