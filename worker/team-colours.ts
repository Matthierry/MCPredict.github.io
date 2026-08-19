export const TEAM_COLOUR_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vR_1dSqKC6BUuykrL9QA5_fwiIEodU3jXBCskHCA7uVU-EYnHusQWZhMFwZXNvk2bFlElmsQHZ3b4n2/pub?gid=1067058604&single=true&output=csv";

export interface TeamColourRecord {
  teamKey: string;
  teamName: string;
  primaryColour: string;
  secondaryColour: string;
}

export interface TeamColourParseResult {
  records: TeamColourRecord[];
  invalidRows: number;
  conflictingTeamKeys: string[];
}

export function normalizeTeamKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function normalizeHexColour(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toUpperCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex.split("").map((digit) => `${digit}${digit}`).join("").toUpperCase()}`;
  }
  return null;
}

export function parseTeamColourRows(rows: string[][]): TeamColourParseResult {
  const byKey = new Map<string, TeamColourRecord>();
  const conflictingTeamKeys = new Set<string>();
  let invalidRows = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const teamName = String(row[1] ?? "").trim();
    if (!teamName) continue;

    // Row 1 is expected to be the header. This guard also keeps the parser safe if
    // the published sheet is re-exported with slightly different header wording.
    if (index === 0 && /team/i.test(teamName)) continue;

    const teamKey = normalizeTeamKey(teamName);
    const primaryColour = normalizeHexColour(row[2]);
    const secondaryColour = normalizeHexColour(row[3]) ?? primaryColour;

    if (!teamKey || !primaryColour || !secondaryColour) {
      invalidRows += 1;
      continue;
    }

    const record: TeamColourRecord = {
      teamKey,
      teamName,
      primaryColour,
      secondaryColour
    };

    const existing = byKey.get(teamKey);
    if (!existing) {
      byKey.set(teamKey, record);
      continue;
    }

    if (
      existing.primaryColour !== record.primaryColour ||
      existing.secondaryColour !== record.secondaryColour
    ) {
      conflictingTeamKeys.add(teamKey);
    }
  }

  for (const key of conflictingTeamKeys) byKey.delete(key);

  return {
    records: Array.from(byKey.values()).sort((a, b) => a.teamKey.localeCompare(b.teamKey)),
    invalidRows,
    conflictingTeamKeys: Array.from(conflictingTeamKeys).sort()
  };
}
