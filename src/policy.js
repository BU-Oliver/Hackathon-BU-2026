/* ============================================================================
   POLICY + WORLD STATE — grounded in the research
   ----------------------------------------------------------------------------
   Every decision here corresponds to a condition that the public survey
   (n=200, data/Social Acceptance...xlsx) found actually moves acceptance.
   The percentages in the "reality" cards are from that survey and the
   CSO/EirGrid series in data/BCP Data.xlsx. See data/EXTRACTED-STATS.md.

   World state, all 0-100:
     environment  local ecological health   → grass, foliage, haze
     water        local water reserves       → lake + village pond shrink
     reliability  facility uptime             → smoke off the hall
     load         grid demand                 → turbines spin harder
     acceptance   community acceptance       → protest signs, boarded pub
   ========================================================================== */

export const START_STATE = {
  environment: 66,
  water: 100,
  reliability: 86,
  load: 42,
  acceptance: 52,
};

const clamp = (v) => Math.max(0, Math.min(100, v));

export const AXES = [
  { key: "environment", label: "Environment", good: "high" },
  { key: "water", label: "Water", good: "high" },
  { key: "reliability", label: "Uptime", good: "high" },
  { key: "load", label: "Grid load", good: "low" },
  { key: "acceptance", label: "Acceptance", good: "high" },
];

/* ------------------------------------------------------------------ policies
 * `pick` is the share of the 200 survey respondents who said this condition
 * would increase their acceptance of a data centre. The "sound" option is the
 * one that implements it. */

export const POLICIES = [
  {
    id: "heat",
    title: "Waste heat — final call",
    brief:
      "There is a district heating loop in the village ready to connect. It needs a guaranteed volume from us before winter.",
    pick: 53,
    options: [
      {
        id: "district",
        label: "Connect the district heating loop",
        sub: "Firm volume, firm contract. Cuts the village's heating bills.",
        tone: 2,
        effects: { environment: +10, acceptance: +22, reliability: +2, load: 0, water: 0 },
        reality:
          "This was the single most popular condition in the survey: 53% of the 200 respondents said redirecting waste heat into local homes and businesses would most increase their acceptance of a data centre. The physics is generous too — a data centre is roughly as efficient as a gas boiler at turning electricity into usable heat, and the low-temperature loop loses very little on the way.",
      },
      {
        id: "vent",
        label: "Keep venting it to atmosphere",
        sub: "Simpler. No contract, no minimum volume, no obligation.",
        tone: 0,
        effects: { environment: -8, acceptance: -14, load: 0, water: 0 },
        reality:
          "Doing nothing here costs you the most popular acceptance lever on the list. The survey found 53% naming waste-heat reuse first, well ahead of renewables — people respond to visible local benefit more than to distant carbon accounting. The heat exists either way; venting just throws it away.",
      },
      {
        id: "aspirational",
        label: "Announce a heat target, connect later",
        sub: "Good press now, all the work deferred to a future quarter.",
        tone: 1,
        effects: { environment: 0, acceptance: +3, reliability: 0 },
        reality:
          "Announcements without delivery are worse than silence here: the survey also found 22.3% of respondents opposed data centres and only 4% said they lacked information, so the problem is not awareness — it is whether promises are kept. Deferring a popular measure spends trust you still have.",
      },
    ],
  },

  {
    id: "renewables",
    title: "Grid mix for next quarter",
    brief:
      "Our power purchase agreement runs out in 90 days. The grid's carbon intensity is falling fast — the question is whether we help or free-ride.",
    pick: 48,
    options: [
      {
        id: "renew",
        label: "Renew the 100% renewable agreement",
        sub: "Premium priced, but locks a clean supply for two years.",
        tone: 2,
        effects: { environment: +12, acceptance: +17, load: -4, water: 0, reliability: 0 },
        reality:
          "48% of respondents named being powered entirely by renewable energy as a condition that would increase their acceptance — and 3.11/5 was the highest-agreement statement in the whole survey: data centres should be required by law to use 100% renewable energy. Meanwhile EirGrid put Irish grid intensity at 224 gCO₂/kWh in 2024, down 75% from 896 in 1990. The grid is decarbonising whether or not you buy into it.",
      },
      {
        id: "market",
        label: "Take the cheap wholesale tariff",
        sub: "Cheapest this quarter. Exposed to carbon pricing and grid queues.",
        tone: 0,
        effects: { environment: -11, acceptance: -12, load: +6, water: 0, reliability: -2 },
        reality:
          "Cheap short-term power is the most expensive power available. Ireland's own data shows why the queue matters: CSO recorded data-centre consumption rising from 1,240 GWh in 2015 to 6,973 GWh in 2024 — now 21.9% of national electricity — and SEAI forecasts roughly 12,800 GWh by 2030. New load is going into a system that already cannot queue it quickly.",
      },
      {
        id: "hold",
        label: "Stay on the current mixed supply",
        sub: "No decision required this quarter.",
        tone: 1,
        effects: { environment: 0, acceptance: -2, load: 0 },
        reality:
          "Mixed supply is where most operators actually sit, so holding is defensible. But it leaves the second-most-popular acceptance lever untouched while the share of Irish electricity going to data centres keeps climbing.",
      },
    ],
  },

  {
    id: "jobs",
    title: "Local employment commitment",
    brief:
      "The county has asked for a written jobs commitment as part of the next consent variation.",
    pick: 40,
    options: [
      {
        id: "guarantee",
        label: "Sign a minimum local jobs guarantee",
        sub: "A floor, not a hope. Harder to recruit from, easier to be neighbour to.",
        tone: 2,
        effects: { acceptance: +18, environment: 0, reliability: 0, load: 0, water: 0 },
        reality:
          "40% of respondents said a minimum number of local jobs would increase their acceptance. Worth noting against the survey's own baseline: only 2.60/5 agreed that data centres already create meaningful long-term local employment, and 2.79/5 agreed the economic benefits flow primarily to large corporations. The public is not convinced the money stays here — a written floor is the thing that changes that.",
      },
      {
        id: "national",
        label: "Recruit nationally, no local floor",
        sub: "A wider talent pool and the salaries that come with it.",
        tone: 0,
        effects: { acceptance: -13, reliability: 0, load: 0, water: 0 },
        reality:
          "A national recruitment policy answers a resourcing problem, not a legitimacy one. The survey's social capital scores were the second-lowest of the five categories (2.87/5), with 3.12/5 for 'communities should receive direct social benefits' — the strongest single statement in that group. Skipping the local commitment attacks the weakest part of your case.",
      },
      {
        id: "open",
        label: "No commitment — advertise openly instead",
        sub: "Post every role, hire whoever applies.",
        tone: 1,
        effects: { acceptance: +4 },
        reality:
          "Open advertising is better than nothing but is not a commitment. In the survey 18.2% of respondents were neutral and 4% said they simply did not have enough information — for those groups, a visible local-hiring floor is the thing that moves them off the fence.",
      },
    ],
  },

  {
    id: "community",
    title: "Community fund",
    brief:
      "There is an ask from the parish council for a ring-fenced fund for local services and amenities.",
    pick: 38,
    options: [
      {
        id: "fund",
        label: "Ring-fence a community fund",
        sub: "Fixed annual contribution, published accounts, no strings.",
        tone: 2,
        effects: { acceptance: +16, environment: 0, load: 0, water: 0, reliability: 0 },
        reality:
          "38% of respondents named funding local community projects as an acceptance condition. The related statement — data centres should be required to make financial contributions to local services — scored 3.11/5, joint highest in the entire survey. Financial capital was also the highest-scoring category overall at 3.00/5, so this is the one area where the public is closest to persuaded.",
      },
      {
        id: "absorb",
        label: "Absorb it in existing spend",
        sub: "We already contribute. No new line item, no new headline.",
        tone: 0,
        effects: { acceptance: -11, environment: 0 },
        reality:
          "Existing spend is invisible. 2.97/5 of respondents agreed the financial gains are shared fairly across Irish society, so 'we already do our bit' is not something the public grants you. If it is not ring-fenced and published, it does not count as a condition being met.",
      },
      {
        id: "conditional",
        label: "Offer a fund, conditional on support",
        sub: "Money available if the community backs the expansion.",
        tone: 0,
        effects: { acceptance: -6 },
        reality:
          "A conditional offer reads as a bribe for permission, and it inverts the consent process. The survey's strongest social statement was 3.12/5 for 'communities should receive direct social or community benefits' — benefits first, consultation alongside, not benefit conditional on approval.",
      },
    ],
  },

  {
    id: "monitoring",
    title: "Environmental monitoring",
    brief:
      "An independent monitoring body has offered to publish open data on our emissions, water and noise.",
    pick: 24,
    options: [
      {
        id: "open",
        label: "Accept independent published monitoring",
        sub: "Someone else's numbers, published monthly, no veto for us.",
        tone: 2,
        effects: { acceptance: +13, environment: +5, reliability: 0, load: 0, water: +3 },
        reality:
          "24% of respondents chose independent, publicly reported monitoring. It buys more than its weight: the survey also found 2.78/5 agreement that data centre operations are 'too hidden and opaque to inspire public trust'. Publishing someone else's data is the cheapest way out of that, and 2.63/5 was recorded for data centres being 'necessary infrastructure for a modern digital economy'.",
      },
      {
        id: "self",
        label: "Self-report instead",
        sub: "Same data, published by us, on our schedule.",
        tone: 0,
        effects: { acceptance: -9, environment: 0 },
        reality:
          "Self-reporting answers the wrong question. Respondents ranked the data centre company itself second among trusted sources (2.83/6) — better than NGOs and local representatives, but behind national regulators (2.63) and barely ahead of independent academics (2.84). If you want your numbers believed, have someone else publish them.",
      },
      {
        id: "optional",
        label: "Keep it optional, publish nothing yet",
        sub: "Nothing to publish, nothing to argue about. Yet.",
        tone: 1,
        effects: { acceptance: -2 },
        reality:
          "Doing nothing keeps the opacity problem exactly where the survey found it. The 4% of respondents with no view at all are the cheapest group to convert — they have told you they are simply uninformed.",
      },
    ],
  },

  {
    id: "landscape",
    title: "Site presentation",
    brief:
      "The county is asking for a design review. The massing is already fixed by the planning consent.",
    pick: 24,
    options: [
      {
        id: "landscape",
        label: "Commission a landscape redesign",
        sub: "Screening, planting and a lower profile. Planning will push back.",
        tone: 2,
        effects: { acceptance: +12, environment: +7, load: 0, water: 0, reliability: -1 },
        reality:
          "24% of respondents chose architectural compatibility with the landscape, and 2.61/5 disagreed that data centre scale is compatible with Irish landscapes. Manufactured capital scored lowest of the five categories at 2.78/5, with 2.66/5 disagreeing that data centres are visually out of place — so appearance is a real but secondary concern. Spending here buys goodwill, not compliance.",
      },
      {
        id: "planting",
        label: "Screen it with planting and move on",
        sub: "Mature trees along the boundary. Cheap, fast, invisible in winter.",
        tone: 1,
        effects: { acceptance: +4, environment: +2 },
        reality:
          "Planting helps at the boundary and does nothing about the thing people actually object to, which is mass and height. 2.72/5 disagreed that a data centre's appearance would negatively affect how they feel about their area — a visual judgement made on massing, not on shrubbery.",
      },
      {
        id: "asbuilt",
        label: "Build as consented, spend on capacity",
        sub: "The capital is better spent on racks than on appearance.",
        tone: 0,
        effects: { acceptance: -10, environment: -3, load: +4 },
        reality:
          "Commercially understandable and publicly costly. The 2.72/5 on visual impact is not a marginal score — it is a third of respondents saying the appearance would sour how they feel about where they live, in a survey where 22.3% were already opposed.",
      },
    ],
  },

  {
    id: "water",
    title: "Local water allocation",
    brief:
      "The village water committee wants a written priority guarantee for the next five years.",
    pick: 13,
    options: [
      {
        id: "guarantee",
        label: "Sign the village priority guarantee",
        sub: "Community ahead of campus in any shortfall. Nearly costs us uptime.",
        tone: 2,
        effects: { water: +16, acceptance: +11, environment: +3, reliability: -2, load: 0 },
        reality:
          "Not the highest-rated condition at 13%, but cheap: in a normal year it costs nothing, and in a dry one it is the only thing standing between you and a curtailment order. Natural capital scored 2.79/5, with 2.66/5 agreeing data centres generate harmful wastewater — the concern is real, and a written priority guarantee is the most direct answer to it.",
      },
      {
        id: "operational",
        label: "Keep campus priority for continuity",
        sub: "Uptime is the contract. Water can be bought elsewhere.",
        tone: 0,
        effects: { water: -18, acceptance: -14, environment: -5, reliability: +3, load: 0 },
        reality:
          "Prioritising the campus is a genuine uptime risk dressed as a safety measure. Operating without a social licence invites exactly the restrictions that threaten continuity — and 2.66/5 of respondents already believe data centres generate harmful wastewater, so the assumption that the public will accept the priority is optimistic.",
      },
      {
        id: "status",
        label: "Keep the current arrangement",
        sub: "No new commitments either way.",
        tone: 1,
        effects: { water: 0, acceptance: -1 },
        reality:
          "Acceptable while there is no pressure. The risk is that pressure arrives at a planning hearing before you have a position, at which point the decision is made for you.",
      },
    ],
  },
];

/* ------------------------------------------------------------------- PRISM
 * PRISM is the in-house assistant. Its advice drifts: follow the naive line
 * often enough and it starts optimising for short-term cost. */

export const ADVICE = {
  heat: {
    sound: "Waste heat is the highest-return move available to us and the community gets a visible benefit from it. It also happens to be what the survey ranks first. Connect it.",
    naive: "District heating ties us into a volume contract we have not tested at scale. Venting is reversible; a heat network is not.",
  },
  renewables: {
    sound: "The grid is decarbonising fast on its own, but free-riding on that is exactly what loses us the argument. 48% of the public named renewables as a condition. Take it.",
    naive: "The PPA premium is real money this year. The grid intensity is already 224 g — we get the decarbonisation either way, so why pay for it?",
  },
  jobs: {
    sound: "A local hiring floor is cheap relative to the goodwill. The public does not believe the economic benefit stays here — a written commitment is what makes it credible.",
    naive: "A local-only floor will cost us the senior engineers we actually need, and we can hire the same people from a wider radius at the same salary.",
  },
  community: {
    sound: "Financial capital was the highest-scoring category in the whole survey. Ring-fence the fund, publish the accounts, and the argument gets much easier.",
    naive: "Ring-fencing money we have not committed is a negotiation we do not need to have yet. Keep it flexible until the consent variation is signed.",
  },
  monitoring: {
    sound: "Independent published monitoring is the cheapest credibility available. We rank below regulators but above NGOs and residents for trust — this lets someone better placed vouch for us.",
    naive: "Opening our numbers monthly hands every future slip to the headlines. Publish annually, after internal review.",
  },
  landscape: {
    sound: "Appearance scores as a secondary concern but a real one. Screening and a lower profile buys goodwill cheaply while the site is still young.",
    naive: "The consent is granted and the massing is fixed. Spending capital on appearance now is spending it away from capacity.",
  },
  water: {
    sound: "The village guarantee costs nothing in a normal year and buys an enormous amount in a dry one. It is the cheapest insurance on the board.",
    naive: "Continuity is the contract that pays the wages. If the committee wants priority they can queue behind every other employer in this town.",
  },
};

export function applyDecision(state, option) {
  const e = option.effects ?? {};
  return {
    environment: clamp(state.environment + (e.environment ?? 0)),
    water: clamp(state.water + (e.water ?? 0)),
    reliability: clamp(state.reliability + (e.reliability ?? 0)),
    load: clamp(state.load + (e.load ?? 0)),
    acceptance: clamp(state.acceptance + (e.acceptance ?? 0)),
  };
}

export const scoreOption = (option) => option.tone;

export function prismStance(followedNaive, followedSound) {
  // PRISM starts helpful; it only turns cynical once you actually follow the
  // bad advice more often than the good advice.
  return followedNaive > followedSound ? "naive" : "sound";
}

export function describeWorld(s) {
  const out = [];
  if (s.acceptance < 22) out.push("There are protest signs on the approach road and the pub has pulled its planning support.");
  else if (s.acceptance < 40) out.push("The parish council has written to the county asking for your consent to be reviewed.");
  else if (s.acceptance > 80) out.push("The village put up a plaque. The football club wants naming rights.");

  if (s.environment < 30) out.push("The hedges are brown and the meadow grass has gone to hay.");
  else if (s.environment > 82) out.push("The meadow beyond the fence is vivid green.");

  if (s.water < 25) out.push("The lake is a puddle — you can see the old shoreline from the road.");
  else if (s.water < 60) out.push("The lake has dropped well below its normal level.");

  if (s.reliability < 30) out.push("Smoke is coming off the roof of Hall A.");
  else if (s.reliability < 55) out.push("Something smells burnt by the loading dock.");

  if (s.load > 78) out.push("The turbines are flat out and the substation is humming.");
  return out;
}
