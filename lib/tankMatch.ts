// Matches the tank name the parser heard ("tank 12", "T12", "12") to one of the user's tanks.

type Named = { id: string; name: string };

/** "Tank 12" -> "12", "T-12a" -> "12a", "ცისტერნა 12" -> "12", "Barrique 3" -> "barrique3". */
export function tankKey(name: string): string {
  const compact = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  // English and Georgian ("ცისტერნა", "ც") prefixes: a voice note in English finds "ცისტერნა 12".
  const numbered = /^(?:tank|t|tk|no|nr|ცისტერნა|ც)(\d.*)$/u.exec(compact);
  return numbered?.[1] ?? compact;
}

/**
 * Returns the single tank matching `spokenName`, or null when there is no
 * match or the match is ambiguous.
 */
export function matchTank<T extends Named>(spokenName: string | null, tanks: readonly T[]): T | null {
  if (!spokenName || spokenName.trim() === '') return null;

  const exact = tanks.filter(
    (tank) => tank.name.trim().toLowerCase() === spokenName.trim().toLowerCase(),
  );
  if (exact.length === 1) return exact[0] ?? null;

  const key = tankKey(spokenName);
  if (key === '') return null;
  const byKey = tanks.filter((tank) => tankKey(tank.name) === key);
  return byKey.length === 1 ? (byKey[0] ?? null) : null;
}
