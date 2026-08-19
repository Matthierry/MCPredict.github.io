import { describe, expect, it } from "vitest";
import { normalizeHexColour, normalizeTeamKey, parseTeamColourRows } from "../worker/team-colours";

describe("team colour parsing", () => {
  it("normalizes team names for safe fixture lookup", () => {
    expect(normalizeTeamKey("West Brom")).toBe("westbrom");
    expect(normalizeTeamKey("Paris Saint-Germain")).toBe("parissaintgermain");
    expect(normalizeTeamKey("Brighton & Hove Albion")).toBe("brightonandhovealbion");
  });

  it("accepts validated hex colours and expands shorthand", () => {
    expect(normalizeHexColour("#ef0107")).toBe("#EF0107");
    expect(normalizeHexColour("063672")).toBe("#063672");
    expect(normalizeHexColour("#abc")).toBe("#AABBCC");
    expect(normalizeHexColour("not-a-colour")).toBeNull();
  });

  it("reads columns B/C/D and falls back to primary when secondary is blank", () => {
    const parsed = parseTeamColourRows([
      ["", "Team Name", "Primary", "Secondary"],
      ["", "Arsenal", "#EF0107", "#063672"],
      ["", "Leeds", "#FFCD00", ""]
    ]);

    expect(parsed.conflictingTeamKeys).toEqual([]);
    expect(parsed.records).toEqual([
      { teamKey: "arsenal", teamName: "Arsenal", primaryColour: "#EF0107", secondaryColour: "#063672" },
      { teamKey: "leeds", teamName: "Leeds", primaryColour: "#FFCD00", secondaryColour: "#FFCD00" }
    ]);
  });

  it("rejects conflicting duplicate team colour rows", () => {
    const parsed = parseTeamColourRows([
      ["", "Team Name", "Primary", "Secondary"],
      ["", "Arsenal", "#EF0107", "#063672"],
      ["", "Arsenal", "#FFFFFF", "#000000"]
    ]);

    expect(parsed.records).toEqual([]);
    expect(parsed.conflictingTeamKeys).toEqual(["arsenal"]);
  });
});
