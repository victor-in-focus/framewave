import type { LibraryClip } from "./libraryApi";

export type LibrarySortMode =
  | "recent"
  | "favorites"
  | "characters"
  | "longest"
  | "az";

function hasReadableWord(value: string): boolean {
  return value
    .split(/[^a-z0-9]+/i)
    .some((part) => part.trim().length >= 2);
}

export function getLibraryDisplayTitle(clip: Pick<LibraryClip, "title">): string {
  const title = clip.title.trim();
  return hasReadableWord(title) ? title : "Untitled reference";
}

export function getLibraryInitials(clip: Pick<LibraryClip, "title">): string {
  const words = getLibraryDisplayTitle(clip)
    .split(/[^a-z0-9]+/i)
    .filter((part) => part.length >= 2);

  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

export function isRecentLibraryClip(
  createdAt: string,
  now: Date = new Date(),
  recentHours = 6
): boolean {
  const created = new Date(createdAt).getTime();
  const referenceTime = now.getTime();

  if (!Number.isFinite(created) || !Number.isFinite(referenceTime)) {
    return false;
  }

  const hoursAgo = (referenceTime - created) / (1000 * 60 * 60);
  return hoursAgo >= 0 && hoursAgo < recentHours;
}

export function truncateMiddle(value: string, maxLength = 36): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength || maxLength < 8) {
    return trimmed;
  }

  const keep = maxLength - 3;
  const head = Math.ceil(keep * 0.6);
  const tail = keep - head;
  return `${trimmed.slice(0, head)}...${trimmed.slice(trimmed.length - tail)}`;
}

export interface LibraryGroup {
  key: string;
  label: string;
  clips: LibraryClip[];
}

function characterKeyFor(clip: LibraryClip): string {
  return clip.tags[0] ?? "";
}

function labelForCharacterKey(key: string): string {
  if (!key) {
    return "No character";
  }

  return key
    .split(/[_-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Group clips by their character tag (the first tag - exports stamp the
 * character name there). Groups and clips are both newest-first;
 * untagged clips gather at the end.
 */
export function groupLibraryClips(clips: LibraryClip[]): LibraryGroup[] {
  const groups = new Map<string, LibraryClip[]>();

  for (const clip of sortLibraryClips(clips, "recent")) {
    const key = characterKeyFor(clip);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(clip);
    } else {
      groups.set(key, [clip]);
    }
  }

  return [...groups.entries()]
    .sort(([leftKey, left], [rightKey, right]) => {
      if (!leftKey !== !rightKey) {
        return leftKey ? -1 : 1;
      }
      return (
        new Date(right[0].createdAt).getTime() -
        new Date(left[0].createdAt).getTime()
      );
    })
    .map(([key, groupClips]) => ({
      key: key || "no-character",
      label: labelForCharacterKey(key),
      clips: groupClips
    }));
}

export function sortLibraryClips(
  clips: LibraryClip[],
  mode: LibrarySortMode
): LibraryClip[] {
  return [...clips].sort((left, right) => {
    if (mode === "favorites") {
      if (left.favorite !== right.favorite) {
        return left.favorite ? -1 : 1;
      }
    }

    if (mode === "longest") {
      return right.duration - left.duration;
    }

    if (mode === "az") {
      return getLibraryDisplayTitle(left).localeCompare(
        getLibraryDisplayTitle(right)
      );
    }

    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
}
