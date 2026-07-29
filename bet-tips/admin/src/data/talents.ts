// Talent list synced to the COP metadata spreadsheet (tipperId, TalentOrShowList,
// NOMAD ID). `initials` seeds GenericContentType; `tipperId` is the Sportsbet
// tipper account id, empty when the talent has none (was "N/A" in the sheet).

export interface Talent {
  name: string;
  /** Nomad Talent Or Show ID -> JSON TalentOrShowList. */
  id: string;
  /** Default initials for GenericContentType (e.g. AFL_FEED_<initials>). */
  initials: string;
  /** Sportsbet tipper account id; "" when the talent has none. */
  tipperId: string;
}

export const TALENTS: Talent[] = [
  { name: "Aaron Finch", id: "f2eac162-c713-42c1-b7ea-9d8a2fe84d1f", initials: "AF", tipperId: "406245" },
  { name: "Alessia Francese", id: "70321f3a-324d-408c-bd1d-ade64db240b6", initials: "AF", tipperId: "" },
  { name: "Alex Donnelly", id: "0adffdab-3e18-488b-8b78-ada3ca9ee44e", initials: "AD", tipperId: "203499" },
  { name: "Alexander Volkanovski", id: "5c76008a-e0f9-408c-89e7-327d98a5083b", initials: "AV", tipperId: "84725" },
  { name: "Ben Graham", id: "9d172407-81d9-4853-af30-bf9d6eef5eeb", initials: "BG", tipperId: "351763" },
  { name: "Brent Zerafa", id: "978ee7b9-50c9-4466-bb23-fa6430c2cc10", initials: "BZ", tipperId: "614816" },
  { name: "Cam Luke", id: "1cb1074a-423c-4750-96e2-2be0723dad44", initials: "CL", tipperId: "84737" },
  { name: "Clint Hutchinson", id: "5cec3be8-d259-47c7-add4-095f05d63de6", initials: "CH", tipperId: "596612" },
  { name: "Dan Ginnane", id: "a30becb1-3a64-46d6-bb60-54db9e7f619f", initials: "DG", tipperId: "88773" },
  { name: "Daniel Hoyne", id: "f6d88a6d-599a-4bcf-b3c7-5bae81a8a3fa", initials: "DH", tipperId: "147440" },
  { name: "Dave Strehlau", id: "1729cc51-7543-4840-9fdd-f1302abc5bd5", initials: "DS", tipperId: "372608" },
  { name: "David Taggart", id: "f1114fc8-4259-42e4-b5e9-dae663e811aa", initials: "DT", tipperId: "84303" },
  { name: "Dean Messiter", id: "ddbed2de-25c9-43d4-9012-ed1e2000577b", initials: "DM", tipperId: "109251" },
  { name: "Denan Kemp", id: "33763839-778a-4667-9d33-6aca1b0559dd", initials: "DK", tipperId: "40" },
  { name: "Fanduel", id: "a2775fcf-8594-44cb-a29c-0bd48f515bc2", initials: "FA", tipperId: "" },
  { name: "Felix Von Hofe", id: "c1d9e33c-52d6-4683-aea8-24bd48827904", initials: "FH", tipperId: "" },
  { name: "FOX", id: "51c6aadc-9edb-47d8-92db-43c6339e54f9", initials: "FO", tipperId: "" },
  { name: "FTTM", id: "4eb12e04-ab7c-4b6e-91fe-843cdf7ec847", initials: "FT", tipperId: "764963" },
  { name: "Get Em Onside", id: "2a67e63d-40bc-4e68-a29d-fb126fc1b847", initials: "GO", tipperId: "147461" },
  { name: "Get On Blackbook", id: "176b4424-4742-4328-876e-3247560dd78e", initials: "GB", tipperId: "327000" },
  { name: "Get On Extra", id: "1f098478-913d-4e46-9124-1692bdd61750", initials: "GE", tipperId: "327000" },
  { name: "Get On Now", id: "d9371d3f-6df5-4ab4-8f3e-2f24f73ec5ee", initials: "GN", tipperId: "327000" },
  { name: "Have A Crack", id: "6d5a6f85-f844-4d5c-a201-19620f1ebf8f", initials: "HC", tipperId: "" },
  { name: "ITBP", id: "e24a50a9-0bb7-484f-8bfb-de8a9555729b", initials: "IT", tipperId: "147440" },
  { name: "Jake Osgathorpe", id: "75de0fb3-70f1-4ad0-8d53-e98966586146", initials: "JO", tipperId: "" },
  { name: "James Lamb", id: "05593ddc-d07a-41f1-9138-917faeefbbef", initials: "JL", tipperId: "" },
  { name: "Jason Richardson", id: "69f3f762-ca0a-450d-9e45-beaa26c656d9", initials: "JR", tipperId: "380699" },
  { name: "Joe Cole", id: "dc70a1f5-a195-47ce-98d3-baad7e3aa7e1", initials: "JC", tipperId: "" },
  { name: "Joel Caine", id: "f73ec127-13df-4b35-a5ab-3ff484e1923e", initials: "JC", tipperId: "85301" },
  { name: "John Kelton", id: "9dbc89b8-0930-499a-b8c7-5587c896c9ed", initials: "JK", tipperId: "114421" },
  { name: "Josh Jenkins", id: "85eb4cb9-e7e2-4933-8802-2f945a452a07", initials: "JJ", tipperId: "56" },
  { name: "Kane Cornes", id: "1c44dd3f-2979-40ec-a01f-5a56ff344a50", initials: "KC", tipperId: "84141" },
  { name: "Kate McCarthy", id: "bea2a886-859b-4b98-be58-4ba3659ee7ac", initials: "KM", tipperId: "85246" },
  { name: "Kelsey Browne", id: "b77df2a3-4c69-4a53-8de0-95df9adbd08c", initials: "KB", tipperId: "327087" },
  { name: "Kick Ons", id: "da436c27-4739-47e0-8ac8-45d207e87ab0", initials: "KO", tipperId: "398045" },
  { name: "Lincoln Moore", id: "b7720b62-8988-4e22-b47c-1d405a55c5c5", initials: "LM", tipperId: "177662" },
  { name: "Lizzie Jelfs", id: "f950c836-848a-4f17-9a98-c665a2095cf5", initials: "LJ", tipperId: "146355" },
  { name: "Lochie Taylor", id: "5ff5bcb7-5426-4b93-8b34-b67f6062ebfd", initials: "LT", tipperId: "40370" },
  { name: "Mat Rogers", id: "6fee73fc-41cb-4e39-88a9-e436d2ec6273", initials: "MR", tipperId: "147461" },
  { name: "Matt Nevett", id: "bda9eb3f-002e-4b04-ae23-94261d59cb1c", initials: "MN", tipperId: "272824" },
  { name: "Meghan Payton", id: "a7080b3c-fd40-4d78-a72c-98fc89ac9940", initials: "MP", tipperId: "" },
  { name: "Mick Comerford", id: "e6ec0371-4221-426a-a897-f617d157d79d", initials: "MC", tipperId: "473317" },
  { name: "Miles Pfitzner", id: "b264ba42-5e21-4dd6-a214-9ca6ea3a49a9", initials: "MP", tipperId: "757084" },
  { name: "MRC", id: "ea07df1f-aa72-4810-ac1c-4f1502607dac", initials: "MR", tipperId: "327000" },
  { name: "Nathan Brown", id: "c94ef6b4-aad8-47a1-b011-fabb8d3f8482", initials: "NB", tipperId: "88780" },
  { name: "Nick Foot", id: "d2c0fd8b-c488-419b-81b8-97b6f7888c54", initials: "NF", tipperId: "" },
  { name: "NRL.com", id: "5ba53294-dcf5-4659-8d21-7cc912b95c17", initials: "NR", tipperId: "906611" },
  { name: "Paddy Power", id: "2ab047a1-f95d-4bc7-a1ae-fd30e9bba43c", initials: "PP", tipperId: "" },
  { name: "Punters", id: "13690a42-aeea-442d-b6bd-2b9087d23718", initials: "PU", tipperId: "" },
  { name: "Racenet", id: "cd1eb65c-5938-4538-aaab-33822ccc6aba", initials: "RA", tipperId: "" },
  { name: "Renee Gartner", id: "a90516f2-6ba9-4f54-ad05-6bfea1598441", initials: "RG", tipperId: "147461" },
  { name: "Rory Flanagan", id: "ee09ccb1-02f8-495c-afdb-2b3f975a6b67", initials: "RF", tipperId: "86511" },
  { name: "Ryan Ingram", id: "1be0e102-ca33-4ffc-8971-467888ecfd44", initials: "RI", tipperId: "327000" },
  { name: "Sam Hyland", id: "d87d0470-f5d8-43c8-a9d0-7409bbf06884", initials: "SH", tipperId: "86765" },
  { name: "Sam Thaiday", id: "a23dbfd8-ce5c-4ba9-a15d-0679936a61e0", initials: "ST", tipperId: "155737" },
  { name: "Sean Ormerod", id: "74e71f66-24f0-42d1-91d1-d65b7d6ffcbf", initials: "SO", tipperId: "82086" },
  { name: "SEN", id: "fc3251b4-602d-40c4-8973-de824958ec59", initials: "SE", tipperId: "788481" },
  { name: "Simon Marshall", id: "eac21741-3968-4294-a03c-14a78334fa94", initials: "SM", tipperId: "21297" },
  { name: "Sporting Life", id: "22c295b0-53f2-444a-a0a3-d10391715989", initials: "SL", tipperId: "" },
  { name: "Tim Yeatman", id: "d052fc6e-684b-4eb4-9d49-4d44a40ab559", initials: "TY", tipperId: "609675" },
  { name: "Trainer Towers", id: "a8cdcd4c-afbe-42ec-a056-5ac1bba807d1", initials: "TT", tipperId: "764963" },
  { name: "Trent Quinn", id: "80b31d94-f995-4da4-a34d-0477513e9335", initials: "TQ", tipperId: "117539" },
  { name: "RDC", id: "5d4ac6f3-71c9-4dd8-aa5b-db8b56b9a1f3", initials: "RD", tipperId: "" },
  { name: "Olantekkers", id: "1d196bfa-cf66-4250-b849-848b59f9b5c3", initials: "OL", tipperId: "267061" },
  { name: "Brett Honey", id: "30bdf750-5c3c-4f2a-8c62-73305b6d07e9", initials: "BH", tipperId: "" },
  { name: "Dan Gorringe", id: "3b9102a0-cc14-417e-a855-aab1c31f9eb3", initials: "DG", tipperId: "38" },
  { name: "Gaby Doxey", id: "9570502c-1012-412b-8b74-66080a3c469d", initials: "GD", tipperId: "327000" },
  { name: "Molly Rose", id: "9d58f2d1-8a50-4210-abc6-486b4b50e295", initials: "MR", tipperId: "327000" },
  { name: "Robbie Kruse", id: "d90e3a16-00ab-4b30-886b-cb32766c44eb", initials: "RK", tipperId: "917203" },
  { name: "Tommy Flanagan", id: "66f2381d-7bb0-4113-bce0-801981a6e47e", initials: "TF", tipperId: "81961" },
  { name: "Garry Lyon", id: "956ac037-e8fc-4d1d-96c0-fb6ba69404f7", initials: "GL", tipperId: "86874" },
  { name: "Mitch Ebyer", id: "dbbd94c6-c1c1-4abe-bdce-f4ee9f0164fe", initials: "ME", tipperId: "118835" },
  { name: "Alexander Volkanovski SMACK", id: "b53993b1-44c8-4ccb-9670-0c2992f31e57", initials: "AV", tipperId: "367669" },
  { name: "Michael Wall", id: "db4f9bd4-7dfa-4392-b3a5-b938d0cb86b9", initials: "MW", tipperId: "102131" },
  { name: "Nick Noonan", id: "790e0d60-cc2e-43c1-adcb-426bc7a8602b", initials: "NN", tipperId: "" },
];

export const talentById = (id: string): Talent | undefined =>
  TALENTS.find((t) => t.id === id);

export const talentByName = (name: string): Talent | undefined => {
  const n = name.trim().toLowerCase();
  return TALENTS.find((t) => t.name.toLowerCase() === n);
};
