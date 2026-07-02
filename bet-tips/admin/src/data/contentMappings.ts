// Content mappings derived from the COP metadata spreadsheet ("contentdropdown"
// sheet). These power the metadata-page dropdowns and the generated video
// metadata JSON. Regenerate from the sheet if the source lists change.

export interface TipType {
  name: string;
  id: string;
}

export interface SportConfig {
  /** Key used in code + stored selection. */
  key: "AFL" | "NRL";
  /** Human label shown in the dropdown. */
  label: string;
  /** Value emitted as JSON `SportsClass` (col F of the sheet). */
  sportsClass: string;
  /** Prefix for `GenericContentType` → `${prefix}_FEED_${initials}`. */
  genericPrefix: string;
  /** Allowed `SportsCompetitionName` values (col G), shown filtered by sport. */
  competitions: string[];
}

// Tip Type → Tip Type ID (col M → O). Becomes JSON `TipType`.
export const TIP_TYPES: TipType[] = [
  { name: "Best Bet", id: "9816746b-2563-4f67-9ad5-f947f7f87801" },
  { name: "Best Of The Day", id: "2901704c-2e39-4306-9de0-95cd0c9c690c" },
  { name: "Exotics", id: "eff1ea23-1d2e-480e-9b8c-1d4fdae69552" },
  { name: "Trifecta", id: "a6d938c8-e168-4e61-aa43-4b9dde3f657f" },
  { name: "More Places Multi", id: "66b2bb35-567f-48d0-b3aa-dd1bb0ae3f8c" },
  { name: "Player Prop", id: "8b4ca14f-2311-4d45-8479-c1846a0f1944" },
  { name: "Quaddie", id: "9c19d0f4-1bd6-4559-bc8c-515865b1444a" },
  { name: "Same Player Multi", id: "0d5b1ec2-35d2-4e25-84e8-c7b86ee2e950" },
  { name: "Same Game Multi", id: "be7213c3-ab11-41e8-ac77-dd020daa9a6c" },
  { name: "Multi", id: "117b408c-41a5-4919-95a8-55570098a46d" },
  { name: "Preview", id: "770063dc-664b-4985-a3ad-2d046e4da3cf" },
  { name: "Review", id: "960efed6-f32d-4309-a216-75878b3b49df" },
  { name: "Highlights", id: "06fca0ff-8ffe-4210-b13e-adb75c06271b" },
  { name: "Futures", id: "be89aec8-63f8-496e-8c25-08712c4787b8" },
  { name: "Value Bet", id: "bfe0f020-e4e5-4ce9-87aa-9611417eca2f" },
];

// Sport → SportsClass + allowed competitions + GenericContentType prefix.
// Scoped to AFL/NRL feeds for now; extend here to add more sports.
export const SPORTS: SportConfig[] = [
  {
    key: "AFL",
    label: "AFL",
    sportsClass: "australian-rules",
    genericPrefix: "AFL",
    competitions: [
      "afl",
      "afl-all-australian",
      "afl-origin",
      "womens-afl",
      "pre-season-challenge",
    ],
  },
  {
    key: "NRL",
    label: "NRL",
    sportsClass: "rugby-league",
    genericPrefix: "NRL",
    competitions: [
      "nrl",
      "nrlw",
      "state-of-origin",
      "womens-state-of-origin",
      "mens-all-stars",
    ],
  },
];

export const sportByKey = (key: string): SportConfig | undefined =>
  SPORTS.find((s) => s.key === key);

export const tipTypeById = (id: string): TipType | undefined =>
  TIP_TYPES.find((t) => t.id === id);
