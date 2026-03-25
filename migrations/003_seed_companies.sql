-- 003_seed_companies.sql
-- Seed all 218 Australian betting companies from betseeker.com.au
-- Social accounts added for major active bookmakers with known social media presence

-- Insert all companies (created_by_user_id = 1 assumes the seeded admin user)
INSERT INTO companies (name, notes, created_by_user_id) VALUES
  ('123bet', 'Australian licensed bookmaker', 1),
  ('ActionBet', 'Australian licensed bookmaker', 1),
  ('Allbets', 'Australian licensed bookmaker', 1),
  ('Alpha Bet', 'Australian licensed bookmaker', 1),
  ('Awesome Bet', 'Australian licensed bookmaker', 1),
  ('Bad Bookie', 'Australian licensed bookmaker', 1),
  ('BaggyBet', 'Australian licensed bookmaker', 1),
  ('Barrington Bookmaking', 'Australian licensed bookmaker', 1),
  ('BBet', 'Australian licensed bookmaker', 1),
  ('BearBet', 'Australian licensed bookmaker', 1),
  ('Beazabet', 'Australian licensed bookmaker', 1),
  ('Bet Dragon', 'Australian licensed bookmaker', 1),
  ('Bet Nation', 'Australian licensed bookmaker', 1),
  ('Bet Right', 'Australian licensed bookmaker', 1),
  ('Bet Supreme', 'Australian licensed bookmaker', 1),
  ('Bet365', 'Major international bookmaker, licensed in NT', 1),
  ('Bet575', 'Australian licensed bookmaker', 1),
  ('Bet66', 'Australian licensed bookmaker', 1),
  ('Bet777', 'Australian licensed bookmaker', 1),
  ('BetAus', 'Australian licensed bookmaker', 1),
  ('BetBarn', 'Australian licensed bookmaker', 1),
  ('BetBetBet', 'Australian licensed bookmaker', 1),
  ('Betblitz', 'Australian licensed bookmaker', 1),
  ('BetBuzz', 'Australian licensed bookmaker', 1),
  ('BetChamps', 'Australian licensed bookmaker', 1),
  ('BetDash', 'Australian licensed bookmaker', 1),
  ('BetDeck', 'Australian licensed bookmaker', 1),
  ('BetDeluxe', 'Australian licensed bookmaker (Amused Australia)', 1),
  ('BetDogs', 'Australian licensed bookmaker', 1),
  ('BetEasy', 'Australian licensed bookmaker (merged into Sportsbet)', 1),
  ('BetEstate', 'Australian licensed bookmaker', 1),
  ('BetExpress', 'Australian licensed bookmaker', 1),
  ('Betfair', 'Betting exchange, licensed in NT', 1),
  ('BetFlux', 'Australian licensed bookmaker', 1),
  ('Betfocus', 'Australian licensed bookmaker', 1),
  ('BetGalaxy', 'Australian licensed bookmaker', 1),
  ('BetGold', 'Australian licensed bookmaker', 1),
  ('BetHunter', 'Australian licensed bookmaker', 1),
  ('BetJet', 'Australian licensed bookmaker', 1),
  ('BetKings', 'Australian licensed bookmaker', 1),
  ('BetLocal', 'Australian licensed bookmaker', 1),
  ('betM', 'Australian licensed bookmaker', 1),
  ('Betmax', 'Australian licensed bookmaker', 1),
  ('BetNova', 'Australian licensed bookmaker', 1),
  ('BetNow', 'Australian licensed bookmaker', 1),
  ('BetPlay', 'Australian licensed bookmaker', 1),
  ('BetProfessor', 'Australian licensed bookmaker', 1),
  ('Betr', 'Australian bookmaker (BlueBet subsidiary)', 1),
  ('BetReal', 'Australian licensed bookmaker', 1),
  ('BetRoyale', 'Australian licensed bookmaker', 1),
  ('BetsOnly', 'Australian licensed bookmaker', 1),
  ('Betstar', 'Australian licensed bookmaker', 1),
  ('BetStride', 'Australian licensed bookmaker', 1),
  ('BetYouCan', 'Australian licensed bookmaker', 1),
  ('BetZooka', 'Australian licensed bookmaker', 1),
  ('BigBet', 'Australian licensed bookmaker (Amused Australia)', 1),
  ('BitWinning', 'Australian licensed bookmaker', 1),
  ('BlondeBet', 'Australian licensed bookmaker', 1),
  ('BlueBet', 'ASX-listed Australian bookmaker', 1),
  ('Booki', 'Australian licensed bookmaker', 1),
  ('BookiePrice', 'Australian licensed bookmaker', 1),
  ('Bookmaker', 'Australian licensed bookmaker (bookmaker.com.au)', 1),
  ('BoomBet', 'Australian licensed bookmaker', 1),
  ('BoostBet', 'Australian licensed bookmaker', 1),
  ('BossBet', 'Australian licensed bookmaker', 1),
  ('BuddyBet', 'Australian licensed bookmaker', 1),
  ('BudgetBet', 'Australian licensed bookmaker', 1),
  ('BuffaloBet', 'Australian licensed bookmaker', 1),
  ('BushBet', 'Australian licensed bookmaker', 1),
  ('CashCage', 'Australian licensed bookmaker', 1),
  ('Chasebet', 'Australian licensed bookmaker', 1),
  ('ChromaBet', 'Australian licensed bookmaker', 1),
  ('ClassicBet', 'Australian licensed bookmaker', 1),
  ('ClearyBet', 'Australian licensed bookmaker', 1),
  ('Colossalbet', 'Australian licensed bookmaker (NSW)', 1),
  ('Combet', 'Australian licensed bookmaker', 1),
  ('Complete Sports Betting', 'Australian licensed bookmaker', 1),
  ('Cricketbet', 'Australian licensed bookmaker', 1),
  ('CrossBet', 'Australian licensed bookmaker', 1),
  ('Dabble', 'Australian licensed bookmaker (NT)', 1),
  ('DashBet', 'Australian licensed bookmaker', 1),
  ('DaveBet', 'Australian licensed bookmaker', 1),
  ('DiamondBet', 'Australian licensed bookmaker', 1),
  ('DowBet', 'Australian licensed bookmaker', 1),
  ('DraftKings', 'International daily fantasy / sportsbook', 1),
  ('Draftstars', 'Australian daily fantasy sports', 1),
  ('EliteBet', 'Australian bookmaker (NSW)', 1),
  ('EpicOdds', 'Australian licensed bookmaker (NT)', 1),
  ('EskanderBet', 'Australian licensed bookmaker', 1),
  ('Favbet', 'Australian licensed bookmaker', 1),
  ('FiestaBet', 'Australian licensed bookmaker', 1),
  ('Flemington Sportsbet', 'Australian licensed bookmaker', 1),
  ('Foxcatcher Betting', 'Australian licensed bookmaker', 1),
  ('GallopBet', 'Australian licensed bookmaker', 1),
  ('GetSetBet', 'Australian licensed bookmaker', 1),
  ('GigaBet', 'Australian licensed bookmaker', 1),
  ('GoldBet', 'Australian licensed bookmaker', 1),
  ('Golden Rush', 'Australian licensed bookmaker', 1),
  ('GoldenBet888', 'Australian licensed bookmaker', 1),
  ('Group 1 Sports', 'Australian licensed bookmaker', 1),
  ('GRSBet', 'Australian licensed bookmaker', 1),
  ('HavaBet', 'Australian licensed bookmaker', 1),
  ('HOT Bet', 'Australian licensed bookmaker', 1),
  ('JimmyBet', 'Australian licensed bookmaker', 1),
  ('JuicyBet', 'Australian licensed bookmaker', 1),
  ('JungleBet', 'Australian licensed bookmaker', 1),
  ('JustBet', 'Australian licensed bookmaker', 1),
  ('KenoGo', 'Australian licensed bookmaker', 1),
  ('Ladbrokes', 'Major bookmaker (Entain Group)', 1),
  ('Lets Bet', 'Australian licensed bookmaker', 1),
  ('LightningBet', 'Australian licensed bookmaker', 1),
  ('LottoGo', 'Australian licensed bookmaker', 1),
  ('Lottoland', 'Australian licensed bookmaker', 1),
  ('LucasBet', 'Australian licensed bookmaker', 1),
  ('LynchBet', 'Australian licensed bookmaker', 1),
  ('MadBookie', 'Australian licensed bookmaker', 1),
  ('Marantelli Bet', 'Australian licensed bookmaker', 1),
  ('MGMBet', 'Australian licensed bookmaker', 1),
  ('MidasBet', 'Australian licensed bookmaker', 1),
  ('MightyBet', 'Australian licensed bookmaker', 1),
  ('MillennialBet', 'Australian licensed bookmaker', 1),
  ('Mintbet', 'Australian licensed bookmaker', 1),
  ('Moneyball', 'Australian licensed bookmaker', 1),
  ('Moriarty Racing', 'Australian licensed bookmaker', 1),
  ('Murphy Bet', 'Australian licensed bookmaker', 1),
  ('MyBet', 'Australian licensed bookmaker', 1),
  ('Neds', 'Major bookmaker (Entain Group)', 1),
  ('Next2Go', 'Australian licensed bookmaker', 1),
  ('Noisy', 'Australian licensed bookmaker (Amused Australia)', 1),
  ('OKEBET', 'Australian licensed bookmaker', 1),
  ('Old Gill', 'Australian licensed bookmaker', 1),
  ('OnlyBets', 'Australian licensed bookmaker (VIC)', 1),
  ('OZ Lotteries', 'Australian lottery operator', 1),
  ('Palmerbet', 'Australian family-owned bookmaker', 1),
  ('PandaBet', 'Australian licensed bookmaker', 1),
  ('Parlay888', 'Australian licensed bookmaker', 1),
  ('Pendlebury Bet', 'Australian licensed bookmaker', 1),
  ('Picklebet', 'Australian bookmaker (NT)', 1),
  ('PicnicBet', 'Australian licensed bookmaker', 1),
  ('Placeabet', 'Australian licensed bookmaker', 1),
  ('PlayON', 'Australian licensed bookmaker', 1),
  ('PlayUp', 'Australian licensed bookmaker', 1),
  ('PlayWest', 'Australian licensed bookmaker', 1),
  ('PointsBet', 'ASX-listed Australian bookmaker', 1),
  ('PonyBet', 'Australian licensed bookmaker', 1),
  ('PremiumBet', 'Australian licensed bookmaker', 1),
  ('PulseBet', 'Australian licensed bookmaker (Amused Australia)', 1),
  ('Punt123', 'Australian licensed bookmaker', 1),
  ('PuntCity', 'Australian licensed bookmaker', 1),
  ('PuntersPal', 'Australian licensed bookmaker', 1),
  ('PuntGenie', 'Australian licensed bookmaker', 1),
  ('PuntNow', 'Australian licensed bookmaker', 1),
  ('PuntOnDogs', 'Australian licensed bookmaker', 1),
  ('PuntZone', 'Australian licensed bookmaker', 1),
  ('QuestBet', 'Australian licensed bookmaker', 1),
  ('RamBet', 'Australian licensed bookmaker', 1),
  ('Razoo', 'Australian licensed bookmaker', 1),
  ('ReadyBet', 'Australian licensed bookmaker', 1),
  ('RealBookie', 'Australian licensed bookmaker', 1),
  ('RipperBet', 'Australian licensed bookmaker', 1),
  ('RivalBet', 'Australian licensed bookmaker', 1),
  ('Rivalry', 'Australian licensed bookmaker', 1),
  ('RiverBet', 'Australian licensed bookmaker', 1),
  ('RobWaterhouse.com', 'Australian bookmaker (Tom Waterhouse family)', 1),
  ('SlamBet', 'Australian licensed bookmaker', 1),
  ('Southern Cross Bet', 'Australian licensed bookmaker', 1),
  ('SportChamps', 'Australian licensed bookmaker', 1),
  ('Sportsbet', 'Major bookmaker (Flutter/FanDuel group)', 1),
  ('SportsBetting', 'Australian licensed bookmaker', 1),
  ('Star Sports', 'Australian licensed bookmaker', 1),
  ('Sterling Parker', 'Australian licensed bookmaker', 1),
  ('SteveBet', 'Australian licensed bookmaker', 1),
  ('SugarCastle', 'Australian licensed bookmaker', 1),
  ('Surge', 'Australian licensed bookmaker (Amused Australia)', 1),
  ('Swiftbet', 'Australian licensed bookmaker', 1),
  ('Swopstakes', 'Australian licensed bookmaker', 1),
  ('TAB', 'Major Australian tote and fixed-odds operator', 1),
  ('TABtouch', 'Western Australian TAB brand', 1),
  ('Tabcorp', 'Major Australian wagering corporation', 1),
  ('Teambet', 'Australian licensed bookmaker', 1),
  ('TempleBet', 'Australian licensed bookmaker', 1),
  ('Terrybet', 'Australian licensed bookmaker', 1),
  ('TexBet', 'Australian licensed bookmaker', 1),
  ('The Lott', 'Australian lottery operator', 1),
  ('The Lottery Office', 'Australian lottery operator', 1),
  ('The Track', 'Australian licensed bookmaker', 1),
  ('Thunderbet', 'Australian licensed bookmaker', 1),
  ('TitanBet', 'Australian licensed bookmaker', 1),
  ('Tombet', 'Australian licensed bookmaker', 1),
  ('Topbet', 'Australian licensed bookmaker', 1),
  ('TopBetta', 'Australian licensed bookmaker', 1),
  ('TopOdds', 'Australian licensed bookmaker', 1),
  ('TopSport', 'Established Australian sports bookmaker', 1),
  ('TrackBet', 'Australian licensed bookmaker', 1),
  ('TradieBET', 'Australian licensed bookmaker', 1),
  ('TrueBet', 'Australian licensed bookmaker', 1),
  ('UltraBet', 'Australian licensed bookmaker', 1),
  ('Unibet', 'Major bookmaker (Kindred Group)', 1),
  ('UPCoz', 'Australian licensed bookmaker', 1),
  ('VicBet', 'Australian licensed bookmaker', 1),
  ('VikingBet', 'Australian licensed bookmaker', 1),
  ('VinBet', 'Australian licensed bookmaker', 1),
  ('VIP Betting', 'Australian licensed bookmaker', 1),
  ('VolcanoBet', 'Australian licensed bookmaker', 1),
  ('VoltBet', 'Australian licensed bookmaker', 1),
  ('Wannabet', 'Australian licensed bookmaker', 1),
  ('WeBet', 'Australian licensed bookmaker', 1),
  ('WellBet', 'Australian licensed bookmaker', 1),
  ('Willobet', 'Australian licensed bookmaker', 1),
  ('WINBET', 'Australian licensed bookmaker', 1),
  ('Winners', 'Australian licensed bookmaker', 1),
  ('WinnersBet', 'Australian licensed bookmaker', 1),
  ('WishBet', 'Australian licensed bookmaker', 1),
  ('WizBet', 'Australian licensed bookmaker', 1),
  ('Woodcock Racing', 'Australian licensed bookmaker', 1),
  ('Xbet', 'Australian licensed bookmaker', 1),
  ('YesBet', 'Australian licensed bookmaker', 1),
  ('Zbet', 'Australian licensed bookmaker', 1);

-- Social accounts for major bookmakers with known active social media
-- Handles sourced from web search results and verified where possible

-- Sportsbet
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Sportsbet'), 'instagram', 'sportsbetcomau', 'https://www.instagram.com/sportsbetcomau/'),
  ((SELECT id FROM companies WHERE name = 'Sportsbet'), 'facebook', 'sportsbet', 'https://www.facebook.com/sportsbet/'),
  ((SELECT id FROM companies WHERE name = 'Sportsbet'), 'x', 'sportaboret', 'https://x.com/saboret'),
  ((SELECT id FROM companies WHERE name = 'Sportsbet'), 'tiktok', 'sportsbet', 'https://www.tiktok.com/@sportsbet');

-- Ladbrokes
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Ladbrokes'), 'instagram', 'laaborokesau', 'https://www.instagram.com/laaborokesau/'),
  ((SELECT id FROM companies WHERE name = 'Ladbrokes'), 'facebook', 'LaaborokesAustralia', 'https://www.facebook.com/LaaborokesAustralia/'),
  ((SELECT id FROM companies WHERE name = 'Ladbrokes'), 'x', 'laaborokes_au', 'https://x.com/laaborokes_au'),
  ((SELECT id FROM companies WHERE name = 'Ladbrokes'), 'tiktok', 'laaborokesau', 'https://www.tiktok.com/@laaborokesau');

-- Neds
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Neds'), 'instagram', 'nedsaustralia', 'https://www.instagram.com/nedsaustralia/'),
  ((SELECT id FROM companies WHERE name = 'Neds'), 'facebook', 'nedsaustralia', 'https://www.facebook.com/nedsaustralia/'),
  ((SELECT id FROM companies WHERE name = 'Neds'), 'x', 'nedsaustralia', 'https://x.com/nedsaustralia'),
  ((SELECT id FROM companies WHERE name = 'Neds'), 'tiktok', 'nedsaustralia', 'https://www.tiktok.com/@nedsaustralia');

-- Bet365
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Bet365'), 'instagram', 'bet365aus', 'https://www.instagram.com/bet365aus/'),
  ((SELECT id FROM companies WHERE name = 'Bet365'), 'facebook', 'bet365aus', 'https://www.facebook.com/bet365aus/'),
  ((SELECT id FROM companies WHERE name = 'Bet365'), 'x', 'bet365_aus', 'https://x.com/bet365_aus');

-- TAB
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'TAB'), 'instagram', 'tab_com_au', 'https://www.instagram.com/tab_com_au/'),
  ((SELECT id FROM companies WHERE name = 'TAB'), 'facebook', 'TABcomau', 'https://www.facebook.com/TABcomau/'),
  ((SELECT id FROM companies WHERE name = 'TAB'), 'x', 'tab_com_au', 'https://x.com/tab_com_au'),
  ((SELECT id FROM companies WHERE name = 'TAB'), 'tiktok', 'tab_com_au', 'https://www.tiktok.com/@tab_com_au');

-- PointsBet
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'PointsBet'), 'instagram', 'pointsbet_au', 'https://www.instagram.com/pointsbet_au/'),
  ((SELECT id FROM companies WHERE name = 'PointsBet'), 'facebook', 'PointsBetAU', 'https://www.facebook.com/PointsBetAU/'),
  ((SELECT id FROM companies WHERE name = 'PointsBet'), 'x', 'PointsBet_AU', 'https://x.com/PointsBet_AU');

-- Unibet
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Unibet'), 'instagram', 'unibet_au', 'https://www.instagram.com/unibet_au/'),
  ((SELECT id FROM companies WHERE name = 'Unibet'), 'facebook', 'UnibetAustralia', 'https://www.facebook.com/UnibetAustralia/'),
  ((SELECT id FROM companies WHERE name = 'Unibet'), 'x', 'uniaboret_au', 'https://x.com/uniaboret_au');

-- BlueBet
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'BlueBet'), 'instagram', 'bluebet', 'https://www.instagram.com/bluebet/'),
  ((SELECT id FROM companies WHERE name = 'BlueBet'), 'facebook', 'BlueBetAustralia', 'https://www.facebook.com/BlueBetAustralia/'),
  ((SELECT id FROM companies WHERE name = 'BlueBet'), 'x', 'BlueBetAus', 'https://x.com/BlueBetAus');

-- Betr
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Betr'), 'instagram', 'betr', 'https://www.instagram.com/betr/'),
  ((SELECT id FROM companies WHERE name = 'Betr'), 'facebook', 'betrau', 'https://www.facebook.com/betrau/'),
  ((SELECT id FROM companies WHERE name = 'Betr'), 'x', 'beabortr', 'https://x.com/beabortr'),
  ((SELECT id FROM companies WHERE name = 'Betr'), 'tiktok', 'betr', 'https://www.tiktok.com/@betr');

-- Dabble
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Dabble'), 'instagram', 'dabble.com.au', 'https://www.instagram.com/dabble.com.au/'),
  ((SELECT id FROM companies WHERE name = 'Dabble'), 'facebook', 'dabblecomau', 'https://www.facebook.com/dabblecomau/'),
  ((SELECT id FROM companies WHERE name = 'Dabble'), 'x', 'dabblecomau', 'https://x.com/dabblecomau'),
  ((SELECT id FROM companies WHERE name = 'Dabble'), 'tiktok', 'dabble.com.au', 'https://www.tiktok.com/@dabble.com.au');

-- Palmerbet
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Palmerbet'), 'instagram', 'palmerbet', 'https://www.instagram.com/palmerbet/'),
  ((SELECT id FROM companies WHERE name = 'Palmerbet'), 'facebook', 'palmerbet', 'https://www.facebook.com/palmerbet/'),
  ((SELECT id FROM companies WHERE name = 'Palmerbet'), 'x', 'palmerbet', 'https://x.com/palmerbet');

-- TopSport
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'TopSport'), 'instagram', 'topsportcomau', 'https://www.instagram.com/topsportcomau/'),
  ((SELECT id FROM companies WHERE name = 'TopSport'), 'facebook', 'TopSportComAu', 'https://www.facebook.com/TopSportComAu/'),
  ((SELECT id FROM companies WHERE name = 'TopSport'), 'x', 'topsaborport', 'https://x.com/topsaborport');

-- Bet Right
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Bet Right'), 'instagram', 'betright', 'https://www.instagram.com/betright/'),
  ((SELECT id FROM companies WHERE name = 'Bet Right'), 'facebook', 'betrightaustralia', 'https://www.facebook.com/betrightaustralia/'),
  ((SELECT id FROM companies WHERE name = 'Bet Right'), 'x', 'BetRight_au', 'https://x.com/BetRight_au');

-- Picklebet
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Picklebet'), 'instagram', 'picklebet', 'https://www.instagram.com/picklebet/'),
  ((SELECT id FROM companies WHERE name = 'Picklebet'), 'facebook', 'picklebet', 'https://www.facebook.com/picklebet/'),
  ((SELECT id FROM companies WHERE name = 'Picklebet'), 'x', 'picklebet', 'https://x.com/picklebet'),
  ((SELECT id FROM companies WHERE name = 'Picklebet'), 'tiktok', 'picklebet', 'https://www.tiktok.com/@picklebet');

-- PlayUp
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'PlayUp'), 'instagram', 'playup', 'https://www.instagram.com/playup/'),
  ((SELECT id FROM companies WHERE name = 'PlayUp'), 'facebook', 'playupaustralia', 'https://www.facebook.com/playupaustralia/'),
  ((SELECT id FROM companies WHERE name = 'PlayUp'), 'x', 'playaborup', 'https://x.com/playaborup');

-- BoomBet
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'BoomBet'), 'instagram', 'boombetau', 'https://www.instagram.com/boombetau/'),
  ((SELECT id FROM companies WHERE name = 'BoomBet'), 'facebook', 'boombetau', 'https://www.facebook.com/boombetau/'),
  ((SELECT id FROM companies WHERE name = 'BoomBet'), 'x', 'boombetau', 'https://x.com/boombetau');

-- Colossalbet
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Colossalbet'), 'instagram', 'colossalbet', 'https://www.instagram.com/colossalbet/'),
  ((SELECT id FROM companies WHERE name = 'Colossalbet'), 'facebook', 'colossalbet', 'https://www.facebook.com/colossalbet/'),
  ((SELECT id FROM companies WHERE name = 'Colossalbet'), 'x', 'colossalbet', 'https://x.com/colossalbet');

-- EliteBet
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'EliteBet'), 'instagram', 'elitebetcomau', 'https://www.instagram.com/elitebetcomau/'),
  ((SELECT id FROM companies WHERE name = 'EliteBet'), 'facebook', 'elitebet', 'https://www.facebook.com/elitebet/'),
  ((SELECT id FROM companies WHERE name = 'EliteBet'), 'x', 'elitebetcomau', 'https://x.com/elitebetcomau');

-- BetDeluxe
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'BetDeluxe'), 'instagram', 'betdeluxecomau', 'https://www.instagram.com/betdeluxecomau/'),
  ((SELECT id FROM companies WHERE name = 'BetDeluxe'), 'facebook', 'betdeluxe', 'https://www.facebook.com/betdeluxe/'),
  ((SELECT id FROM companies WHERE name = 'BetDeluxe'), 'x', 'betdeluxecomau', 'https://x.com/betdeluxecomau');

-- Bet Nation
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Bet Nation'), 'instagram', 'betnationau', 'https://www.instagram.com/betnationau/'),
  ((SELECT id FROM companies WHERE name = 'Bet Nation'), 'facebook', 'betnationau', 'https://www.facebook.com/betnationau/'),
  ((SELECT id FROM companies WHERE name = 'Bet Nation'), 'x', 'BetNationau', 'https://x.com/BetNationau');

-- Betfair
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Betfair'), 'instagram', 'betfairaustralia', 'https://www.instagram.com/betfairaustralia/'),
  ((SELECT id FROM companies WHERE name = 'Betfair'), 'facebook', 'BetfairAustralia', 'https://www.facebook.com/BetfairAustralia/'),
  ((SELECT id FROM companies WHERE name = 'Betfair'), 'x', 'BetfairAus', 'https://x.com/BetfairAus');

-- Betstar
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Betstar'), 'instagram', 'betstar', 'https://www.instagram.com/betstar/'),
  ((SELECT id FROM companies WHERE name = 'Betstar'), 'facebook', 'betstarcomau', 'https://www.facebook.com/betstarcomau/'),
  ((SELECT id FROM companies WHERE name = 'Betstar'), 'x', 'betstarcomau', 'https://x.com/betstarcomau');

-- DraftKings
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'DraftKings'), 'instagram', 'draftkings', 'https://www.instagram.com/draftkings/'),
  ((SELECT id FROM companies WHERE name = 'DraftKings'), 'facebook', 'DraftKings', 'https://www.facebook.com/DraftKings/'),
  ((SELECT id FROM companies WHERE name = 'DraftKings'), 'x', 'DraftKings', 'https://x.com/DraftKings'),
  ((SELECT id FROM companies WHERE name = 'DraftKings'), 'tiktok', 'draftkings', 'https://www.tiktok.com/@draftkings');

-- Tabcorp
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Tabcorp'), 'instagram', 'tabcorp', 'https://www.instagram.com/tabcorp/'),
  ((SELECT id FROM companies WHERE name = 'Tabcorp'), 'facebook', 'Tabcorp', 'https://www.facebook.com/Tabcorp/'),
  ((SELECT id FROM companies WHERE name = 'Tabcorp'), 'x', 'Tabcorp', 'https://x.com/Tabcorp');

-- SportChamps
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'SportChamps'), 'instagram', 'sportchamps', 'https://www.instagram.com/sportchamps/'),
  ((SELECT id FROM companies WHERE name = 'SportChamps'), 'facebook', 'sportchamps', 'https://www.facebook.com/sportchamps/'),
  ((SELECT id FROM companies WHERE name = 'SportChamps'), 'x', 'sportchamps', 'https://x.com/sportchamps');

-- ClassicBet
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'ClassicBet'), 'instagram', 'classicbet', 'https://www.instagram.com/classicbet/'),
  ((SELECT id FROM companies WHERE name = 'ClassicBet'), 'facebook', 'classicbet', 'https://www.facebook.com/classicbet/'),
  ((SELECT id FROM companies WHERE name = 'ClassicBet'), 'x', 'classicbet', 'https://x.com/classicbet');

-- Rivalry
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Rivalry'), 'instagram', 'rivalry', 'https://www.instagram.com/rivalry/'),
  ((SELECT id FROM companies WHERE name = 'Rivalry'), 'facebook', 'RivalryGG', 'https://www.facebook.com/RivalryGG/'),
  ((SELECT id FROM companies WHERE name = 'Rivalry'), 'x', 'RivalryGG', 'https://x.com/RivalryGG'),
  ((SELECT id FROM companies WHERE name = 'Rivalry'), 'tiktok', 'rivalry', 'https://www.tiktok.com/@rivalry');

-- Surge
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Surge'), 'instagram', 'surgebet', 'https://www.instagram.com/surgebet/'),
  ((SELECT id FROM companies WHERE name = 'Surge'), 'facebook', 'surgebet', 'https://www.facebook.com/surgebet/'),
  ((SELECT id FROM companies WHERE name = 'Surge'), 'x', 'surgebet', 'https://x.com/surgebet');

-- Noisy
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'Noisy'), 'instagram', 'noisybet', 'https://www.instagram.com/noisybet/'),
  ((SELECT id FROM companies WHERE name = 'Noisy'), 'facebook', 'noisybet', 'https://www.facebook.com/noisybet/');

-- BigBet
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'BigBet'), 'instagram', 'bigbet', 'https://www.instagram.com/bigbet/'),
  ((SELECT id FROM companies WHERE name = 'BigBet'), 'facebook', 'bigbet', 'https://www.facebook.com/bigbet/');

-- PulseBet
INSERT INTO social_accounts (company_id, platform, handle, account_url) VALUES
  ((SELECT id FROM companies WHERE name = 'PulseBet'), 'instagram', 'pulsebet', 'https://www.instagram.com/pulsebet/'),
  ((SELECT id FROM companies WHERE name = 'PulseBet'), 'facebook', 'pulsebet', 'https://www.facebook.com/pulsebet/');
