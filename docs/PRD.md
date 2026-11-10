# Campus prediction market PRD

Nov 10, 2026 · @Mael

## Summary

A play-money prediction market for one friend group at ISEN and the friends they bring in: 10 players at worst, 50 at best. Anyone asks a yes/no question about the group's life, everyone bets fake coins on it, and the price shows what the group really thinks. It is a game: no real money goes in or comes out.

**The problem.** Friends already bet on each other in group chats ("he'll never show up", "she's failing that exam"). Nobody keeps score, nobody remembers who called it, and the bet is gone in an hour.

**Who it's for.** Your friend group first, then friends of friends who know the same people. Nobody joins without an invite from a member.

**Why so small.** The game is only funny when every player knows the people in the markets. At 10 to 50 players everyone does, so this is built for a group, not a platform: one shared space, one leaderboard, inside jokes as the content, and you running things by hand wherever software would be overkill.

The app is called Poly'sen, a nod to Polymarket and ISEN. Its currency has no name yet, so this document calls it "coins".

## Goals and non-goals

**Goals**

1. **People come back without being asked.** 70% of members bet in any given week.
2. **The group grows to its natural size on its own.** From about 10 founders to 20 or more within two months, all through invites.
3. **The content makes itself.** By week 4, more than half of new markets are created by someone other than you.
4. **Outcomes are trusted.** Every market resolves within a day of closing, and you settle every dispute within 24 hours.
5. **Nobody gets hurt.** No market about a person goes live without that person's approval.
6. **You run a real product.** A release every week, a changelog, and feedback gathered in person as much as in the app.

**Non-goals**

- **Real money, paid coins or valuable prizes.** That is the legal line between a game and gambling, and it changes why people play.
- **Accurate forecasting.** This is entertainment. Nobody needs the prices to be right.
- **Growing past friends of friends.** No open sign-up, no other schools, no marketing.
- **Building for scale.** No moderation team, recommendation feed, search or automated moderation. At 50 people you can read everything yourself.
- **Native iOS and Android apps.** An installable web app opens from a link in the group chat.
- **Anonymous accounts, and any tie to the BDE or the school administration.**

## Users and user stories

Four roles, and one person can hold several at once.

| Role | Who | What they want |
| --- | --- | --- |
| Player | Every member | To bet on what they think will happen and be proven right in front of their friends |
| Creator | Anyone who launches a market | To start the bet the whole group argues about |
| Named person | A member a market is about | To stay in control of what is said about them |
| Admin | You, plus one friend as backup | To keep it fair and fun without it becoming a job |

**Player**

- As a friend who just got the link, I want to sign up with Google in under a minute so that I can bet before the conversation moves on.
- As a player, I want to see every open market and what my friends bet on one screen so that I know where the argument is.
- As a player, I want to see what I could win before I confirm so that I understand the bet.
- As a player, I want to sell my position before the market closes so that I can lock in a win or cut a loss.
- As a player, I want a daily drop of coins so that a bad streak never locks me out.
- As a player, I want to see where I stand against everyone this week and this season so that being right earns me bragging rights.
- As a player, I want to dispute a result I think is wrong so that nobody can cheat.

**Creator**

- As a creator, I want to launch a market in under 30 seconds so that I catch the moment while everyone is talking about it.
- As a creator, I want to drop my market's link in the group chat so that everyone piles in.
- As a creator, I want to earn coins when people bet on my market so that good questions are rewarded.

**Named person**

- As a member named in a market, I want to approve it before anyone sees it so that nothing about me goes live without my say.
- As a member named in a market, I want to take it down at any time so that a joke that stops being funny ends.

**Admin**

- As the admin, I want to see reports and disputes in one place so that I can settle them within a day.
- As the admin, I want to cancel a market and refund everyone so that a bad market costs nobody coins.
- As the admin, I want a log of what I did so that friends can see I was fair.

## How the game works

### The daily loop

1. Open the app and claim the daily drop.
2. See what changed since yesterday: new markets, who bet what, what closes tonight.
3. Bet on a market, or sell a position that has moved your way.
4. Launch your own market when something bet-worthy happens.
5. Markets resolve: winners are paid and the leaderboard moves.
6. Gloat in the group chat.

### Coins

Every number here is a starting value to tune with the founders.

| Rule | Value | Why |
| --- | --- | --- |
| Starting balance | 1,000 coins | Enough for about ten real bets |
| Daily drop | 50 coins, claimed by opening the app | A reason to come back; it does not pile up if you skip a day |
| Streak bonus | +10 per consecutive day, up to +50 | Rewards habit without drowning the economy |
| Launching a market | 100 coins, which become the market's starting pool | Stops spam and makes the first bets possible |
| Creator bonus | 10 coins for each person who bets on your market | Rewards questions that get the whole group in; a fee on trades would earn almost nothing at this size |
| Winning share | Pays 1 coin | A share bought at 0.25 quadruples if you are right |

Coins cannot be bought, sent to another member or cashed out. Leaderboards rank **profit from trading**, not balance, so the daily drop funds play but never wins the ranking. A season is one semester; at the start of each season everyone goes back to 1,000 coins and past winners stay in a hall of fame.

### Markets

- **Yes/no questions only in v1.** "Will Tom actually show up to Friday's run?"
- **The price is the group's probability**, from 1% to 99%. Betting 100 coins on YES at 25% wins up to 400 if you are right. Your own bet moves the price, so the win is smaller on a quiet market; the exact number shows before you confirm.
- **The app is always the other side of the trade.** An automated market maker quotes a price and moves it with every bet, so a market works with three players. [Manifold](https://manifold.markets/) uses the same family of design.
- **You can sell any time before the close**, at the current price.
- **Every market states how it will be judged.** The creator writes the question, the close date and one line of "how we'll know".
- **One shared space.** Every member sees every market, once any named person has approved it.
- **Limit:** three new markets per member per day.

### From question to payout

&#91;embedded content: market lifecycle · 8 states\]

A market that names someone waits for their approval; everything else opens at once. After the close the creator proposes a result, and it pays out after 24 hours unless someone disputes it.

### Resolution rules

- The creator resolves YES, NO or Cancel, and must attach proof: a photo, a message screenshot or a named witness.
- A result pays out 24 hours after it is proposed, which leaves time to dispute it.
- One dispute is enough to send it to you. If you traded in that market, your backup admin decides instead.
- No result within 48 hours of the close: you resolve or cancel it.
- A cancelled market refunds every player what they put in.
- A creator whose result is overturned loses the creator bonus on that market. Someone who does it twice loses the right to create markets for the rest of the season.
- Creators and named people may bet on their own markets, and the market page says so publicly.

## Must-have requirements (P0)

The app cannot open to your friends without these ten, plus share links. Tick each criterion as you ship it.

**1. Sign-up by invitation**

- [ ] A new member joins from an invite link sent by an existing member; the app records who invited whom.
- [ ] The member signs in with Google, or with an email and a password. A school email is not required.
- [ ] The first test version may ship with username and password only; Google sign-in is added before invites open.
- [ ] Passwords are handled by a tested sign-in library or provider and are never stored in readable form.
- [ ] The profile holds a first name, a nickname and a photo, and shows them on every bet and market.

**2. Wallet and daily drop**

- [ ] A new account starts with 1,000 coins.
- [ ] The daily drop can be claimed once per calendar day (Paris time); a second claim is refused.
- [ ] Every coin movement appears in a history the member can read: drop, bet, sale, payout, refund, bonus.
- [ ] A balance can never go below zero.

**3. Create a market**

- [ ] A creator fills in a question, a "how we'll know" line and a close date, then pays 100 coins.
- [ ] A creator with fewer than 100 coins, or three markets already created today, is refused with the reason.
- [ ] A market with no named person opens immediately at 50%.

**4. Naming a person**

- [ ] A creator can tag only members.
- [ ] A market that tags someone stays invisible to everyone else until each tagged person approves it.
- [ ] A tagged person can refuse it, or remove it later with one tap; the market is cancelled and all stakes refunded.
- [ ] A market with no reply after 48 hours is cancelled and the creator refunded.

**5. Trade**

- [ ] A player picks YES or NO and an amount, and sees the shares they get, the new price and the payout if they win before confirming.
- [ ] A confirmed bet updates the balance, the position and the market price in one step; a failure changes nothing.
- [ ] A player can sell all or part of a position before the close, with the proceeds shown first.
- [ ] No trade is accepted after the close date.

**6. Market page**

- [ ] Shows the question, the judging line, the current probability, a price history chart, the close date and the creator.
- [ ] Shows every bet with the player's name and amount.
- [ ] Shows a public badge when the creator or a named person holds a position.
- [ ] Has a comment thread.

**7. Home screen**

- [ ] Lists every open market on one screen, closing soonest first.
- [ ] Shows a feed of what friends just did: "Léa bought 200 on YES", "Tom's market just resolved".

**8. Resolution, disputes and payout**

- [ ] After the close, only the creator can propose YES, NO or Cancel, and must attach proof.
- [ ] Any player in the market can dispute during the 24-hour window, and one dispute sends it to the admin.
- [ ] With no dispute, winners are paid automatically at the end of the window.
- [ ] A disputed market pays out only after the admin rules.
- [ ] Across every resolved market, coins paid out equal coins held by the market: none created, none lost.

**9. Portfolio and leaderboard**

- [ ] A member sees every open position with its current value and profit or loss, and their resolved bets with the result of each.
- [ ] One leaderboard ranks every member by trading profit, with a "this week" tab and a "this season" tab; daily drops and bonuses are excluded.
- [ ] Markets with fewer than three players do not count toward the leaderboard.

**10. Admin tools**

- [ ] Every market and comment has a report button; a reported market is hidden until the admin looks at it.
- [ ] One admin page lists reports and disputes, and lets the admin hide, cancel and refund, or resolve a market, delete a comment or suspend a member.
- [ ] The creation form shows the content rules and blocks submission until the creator accepts them.
- [ ] Every admin action is logged with who, what and when, and members can read the log.

**Sharing.** Every market has a link that opens the market page directly and shows the question and current odds as a preview in WhatsApp, Instagram and Discord. A link shared by a member doubles as an invitation: someone without an account signs up, then lands on the market.

## Game layer

Fake coins are worth earning when the people you beat are your friends and what you buy is something they will see. At 10 to 50 players, every feature below is built around people who know each other, not strangers on a ladder. It arrives after invites open and blocks none of the P0 list.

### What works elsewhere

| App | Mechanic | The lesson at your size |
| --- | --- | --- |
| [Duolingo](https://duolingo.deconstructoroffun.com/mechanics/leagues) | Leaderboards reset every week, results revealed on Monday | A contest that restarts weekly gives everyone a fresh shot, even after a bad week |
| [Duolingo](https://blog.duolingo.com/how-duolingo-streak-builds-habit) | Streak freezes, up to two held at once | Let people miss a day without losing the habit |
| [Manifold](https://manifold.markets/community-guidelines/leagues) | Rankings by profit; bets on your own market in its first hour don't count | The anti-cheating rule matters most when everyone knows the creator |
| [Twitch](https://www.tubefilter.com/2020/11/13/twitch-launches-predictions-feature-channel-points/) | Free points spent on rewards the streamer invents, such as "make me dance on stream" | Worthless coins are fun to spend when the reward is social |
| [Sleeper](https://www.expa.com/news/founder-spotlight-sleeper) | Chat built into the game itself | The trash talk is the real fun, so it should live next to the bets |
| [Gas](https://schools.gabb.com/blog/is-the-gas-app-dangerous/) | Coins bought hints about who voted for you | Curiosity about friends sells best, and is also where harm starts |

### Compete with friends

- **Weekly winner.** The "this week" leaderboard resets every Monday, opening with a reveal of the top three and the week's biggest loser.
- **Weekly duel.** Each week you are paired with one friend at random; whoever makes more profit wins, like a fantasy-league matchup.
- **Rivalries.** Name a nemesis; the app keeps your head-to-head record on every market you both traded.
- **Travelling trophy and wooden spoon.** One 3D-printed trophy passes to each season's champion with every winner's name added, handed over in person. The season's biggest loser gets the spoon.

### Come back every day

- **Market of the day.** One market you pick each morning that everyone bets on, closing at midnight.
- **Recurring markets.** The questions the group always asks ("who's last to Friday drinks?") reopen by themselves every week.
- **Quests.** Small coin rewards for daily tasks (bet on three markets) and weekly ones (create a market that draws five players, win a bet the group priced under 30%).
- **Streak freeze.** Bought with coins, at most two held at once.
- **Flash markets.** Open for 5 to 60 minutes while you are together, at a match, a party or a game night, and resolved on the spot.

### Spend coins

- **Billboard.** One banner at the top of everyone's home screen, auctioned each week. The winner writes the message; you approve it.
- **Friend titles.** Stick a title from a preset list ("Certified Late") on a friend's profile for 24 hours. They can bounce it back for double the price, or turn titles off in their settings.
- **Bounties.** Offer coins to whoever creates the best market on a topic you care about.
- **Cosmetics.** Profile titles, frames, name colours and reactions.
- **Hidden bets** *(test with care)*. Pay to keep your position on one market anonymous; others can pay more to reveal it. Creators and named people can never hide.

Three rules keep the shop fair: spending never changes anyone's rank, because rankings count trading profit only; nothing for sale gives an edge on an outcome; and nothing is random, so there are no loot boxes.

### Share and remember

- **The weekly gazette.** A short, funny recap of the week written by an AI from the group's own markets and comments: best call, biggest upset, best line in the comments. You read and approve it before it posts.
- **Receipts.** An "I called it" card showing you bought YES at 12% before it happened, ready for the group chat.
- **Hall of fame.** The group's best calls, wildest markets and past champions, kept forever.
- **Season Wrapped.** An end-of-semester recap per member: best call, worst call, nemesis record, titles received.
- **Achievements.** Badges such as Oracle for the longest run of correct calls, which [Manifold](https://manifold.markets/post/announcing-achievements) also uses, and Contrarian for beating a group that priced you under 20%.

### Keep the economy healthy

Coins enter through drops, quests, wins and creator bonuses, and leave through market fees, the shop and losses. If more enters than leaves, shop prices stop meaning anything. The billboard auction is the main drain, because its price rises with how rich the group is. Check total coins per member each week, and cut quest rewards if the number keeps climbing. The season reset wipes any inflation every semester.

### Order

| When | Features |
| --- | --- |
| First weeks after invites open | Market of the day, weekly winner, quests, streak freeze |
| First fast follows | Push notifications, billboard, friend titles, receipts, recurring markets |
| Later in season 1 | Weekly gazette, flash markets, weekly duel, bounties, cosmetics |
| End of season 1 | Season Wrapped, travelling trophy, hall of fame, achievements |
| Only if wanted | Hidden bets, rivalries |

## Later requirements (P1 and P2)

**P1: fast follows after invites open.** The game layer above is most of P1; these are the rest.

| Feature | What it does | Why it matters |
| --- | --- | --- |
| Push notifications | Tells you when a market you hold moves 20 points, closes or resolves, and when you are tagged | The main reason people reopen the app |
| Multiple-choice markets | "Who arrives last: Tom, Léa or Hugo?" | Many group questions are not yes/no |
| Comment reactions | Emoji reactions and replies in market threads | Keeps the trash talk in the app, next to the bets |

The weekly gazette is the AI feature worth building properly: it needs a small test set of past weeks, a check that it never invents a fact, and a rule that it never jokes about the topics the content rules forbid. That is the evaluation work your roadmap wants.

**P2: later, only if the group asks for it.**

- **Private side groups**, if the group splits into cliques with their own jokes.
- **Bot players.** An API so friends can enter their own trading bots on a separate leaderboard, which engineering students may enjoy more than anything else here.
- **Numeric and date markets.** "How many people show up?", "When will results be posted?"

## Rules, safety and legal

In a group this close, the real risk is not a regulator but a joke that hurts a friend. Most of the rules below exist for that.

### What a market can be about

| Allowed | Not allowed |
| --- | --- |
| Group plans, parties, games, sport, trips | Any named person who has not approved it |
| Exams and courses as a whole ("will the exam be postponed?") | Teachers, staff and anyone who is not a member |
| A friend's actions, once that friend has approved | Health, sexuality, religion, origins, politics, money, looks or family, even with approval |
| Love-life jokes, only if every person involved is tagged and approves | Anything sexual |
| Your own goals ("will I finish my project by Sunday?") | Markets someone could win by doing something dangerous, illegal or humiliating: drinking, hazing, cheating, breaking school rules |
| News, weather, pop culture | Accidents, injuries, deaths, disciplinary cases |

The rule against harmful outcomes matters most. A market pays people to make its outcome happen, so the outcome must never be something that hurts someone.

### Running it

- You are the admin, with one trusted friend as backup for markets you have traded in and for when you are away.
- At this size you will see every market and comment, so a single report hides a market until one of you looks.
- Every report and dispute gets a decision within 24 hours.
- These are your friends: talk to the person first. If it happens again, remove their right to create markets; after that, remove them from the group.

### Cheating

- **Second accounts.** In a group where everyone knows everyone, a stranger stands out. Invitations show who brought each account in, coins cannot be sent between members, and markets with fewer than three players do not count toward the leaderboard.
- **Lying about a result** is handled by disputes and the loss of creator rights.
- **Bugs.** Your friends are engineers and will try to break the economy. Publish one rule: reporting a bug earns a badge and coins; using one to win gets your coins reset.

### Staying outside gambling law

French law treats a game as gambling when it is offered to the public, creates the hope of a gain owed even partly to chance, and requires a financial sacrifice from players, meaning a stake or an advance of money ([OFDT note on article L320-1](https://www.ofdt.fr/sites/ofdt/files/2025-07/note-reglementation-jah_8_1.pdf)). The regulator is strict about prediction markets: it said in February 2026 that prediction sites have no legal existence in France, and on 16 July 2026 it ordered internet providers to block Polymarket ([Clubic](https://www.clubic.com/actualite-621835-polymarket-bloque-en-france-le-site-de-paris-sur-l-actualite-devient-inaccessible.html)).

An invite-only game among friends is far from "offered to the public", but the rules below keep it a game no matter who joins:

- It is free. Coins are never sold, in any form.
- Coins have no value outside the app: no cash-out, no gift cards. A token trophy for the season champion is fine because nobody pays anything to play; prizes with real value need legal advice first.
- Coins cannot be transferred between members.
- The app never shows odds from a real-money site. The name nods to Polymarket, so these rules are what keep it a game; if it ever grows past friends of friends, rename it.

This is my reading of the rule, not legal advice.

### Personal data

The app holds your friends' data, and GDPR still applies at this size. Keep it light:

- Collect only a sign-in email or Google account, a first name, a nickname, a photo and what members do in the app.
- Write a privacy note of a few lines, in plain French, and show it at sign-up.
- Host in the EU, with no advertising trackers.
- Let members delete their account; their past bets stay in the totals without their name.
- A market about a person is that person's data. The approval step is their consent, and the remove button is their right to withdraw it.

### The school

A private game among friends does not need the administration's approval. Tell them only if it grows beyond friends of friends. The name nods to ISEN, which is fine among friends; keep the school's logo out of it.

## Success metrics

With 10 to 50 players, the numbers that matter are how many friends keep playing, not how many join. Targets are first guesses; reset them after the first month.

| Metric | Target | Measured |
| --- | --- | --- |
| Founding members | 10 in the first week | Once |
| New members who bet within 24 hours of joining | 90% | Weekly |
| Members who bet in a given week | 70% | Weekly |
| Members who bet on 3 or more days a week | 40% | Weekly, from week 4 |
| New markets per week | 10 | Weekly |
| Markets created by someone other than you | More than half | From week 4 |
| Markets resolved within a day of closing | All but the odd one | Weekly |
| Members after two months | 20 or more (dream: 50) | Month 2 |
| Members who come back for season 2 | 70% | Start of season 2 |

**Feedback.** Talk to three players a week, in person. At this size a conversation tells you more than any dashboard.

**Watch, with no target:** how often named people refuse or remove markets. Often means creators are misjudging what their friends find funny.

**Stop-and-rethink line:** fewer than six people betting in a week, two weeks running, after the first month.

## Phasing

The app takes the slot the F1 strategist held in your roadmap, between the chess LLM and the security flagship.

1. **Paper test.** Run ten markets by hand in your group chat, with a spreadsheet as the bank. Go on only if at least half the group bets on three or more markets and someone other than you proposes one.
2. **Build the MVP.** The ten must-haves, in this order: wallet and ledger, market maker, create and trade, resolution, home screen, admin tools.
3. **Founding ten.** Your closest friends only. Tune the coin numbers with them, fix what confuses them, and write the privacy note.
4. **Invites open.** Founders can invite friends of friends, with a few markets already live on day one. Season 1 starts.
5. **Fast follows.** The first wave of the game layer, then the gazette.
6. **Security flagship starts.** The app moves to maintenance: one release a fortnight, and a backup admin who can run it without you before you leave for Korea.

### Build notes

- **Write two parts by hand:** the market maker maths and the coin ledger. Everything else can be built with your AI tools.
- **One ledger.** Every coin movement is a row; balances are computed from the rows and never edited directly.
- **Atomic trades.** A bet updates balance, position and price in a single database transaction, and a repeated request cannot spend twice.
- **Server decides.** Prices and payouts are computed on the server only.
- **Two tests before any friend joins:** across any sequence of trades and a resolution, total coins are conserved, and no balance goes below zero.
- **Keep it cheap.** At 50 users, a free tier of a hosted database and a small server is enough.
- **Keep a decision log**, as your roadmap already asks.

## Decisions to confirm and open questions

**Calls I made for you.** Each is written into the sections above; change any you disagree with.

| Decision | What I chose | The alternative |
| --- | --- | --- |
| How prices work | An automated market maker with live odds and selling | A simple pool where winners split the pot: easier to build, but no live price and no selling |
| Who can join | Anyone invited by a member, signing in with Google or email | Open sign-up, or school-email checks |
| One space or groups | One shared space for everyone | Private side groups, kept for later |
| Seasons | Everyone resets to 1,000 coins each semester | Balances carry over forever, which favours early players |
| Creators and named people betting | Allowed and shown publicly, with disputes as the check | Banned, which is fairer but less fun |
| Identity | First name, nickname and photo, visible to every member | Pseudonyms, which make the jokes land less |
| Platform | Installable web app | Native apps |
| Interface language | French | English, or both |
| Starting pool per market | 100 coins, so prices swing a lot | A bigger pool for calmer prices |

**Questions only you can answer**

- [ ] **Name.** The app is Poly'sen. What is the currency called? *Before the founding ten.*
- [ ] **Founders.** Who are the first ten, and is the group mostly one friend group or several? *Before the paper test.*
- [ ] **Backup admin.** Which friend, and will they run it while you are in Korea? *Before invites open.*
- [ ] **Members under 18.** Will anyone under 18 join, and do you let them in? *Before invites open.*
- [ ] **Budget.** Hosting, a domain and email sending cost a few euros a month at most. What is your ceiling? *Before the build.*
