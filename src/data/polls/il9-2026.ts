import type { PollData } from "./index";

export const il9Poll: PollData = {
  slug: "il-9-congressional-2026",
  title: "IL-09 Democratic Primary Poll",
  subtitle: "IL-09 Congressional Democratic Primary",
  date: "February 15–20, 2026",
  sponsor: "CAIR Action",
  sampleSize: 638,
  marginOfError: 3.9,
  population: "IL-09 Democratic Primary Electorate",
  keyFinding:
    "Daniel Biss leads with 31% but 21% remain undecided — turnout among low-propensity voters is the key variable, with accountability and ICE oversight driving engagement.",

  sections: [
    // 1. Vote Choice — Horizontal bar
    {
      type: "horizontal-bar",
      title: "Initial Vote Choice",
      description:
        "Mayor Daniel Biss commands a substantial lead but a large proportion of primary voters remain undecided less than a month out from primary day.",
      xAxisKey: "candidate",
      series: [
        { dataKey: "pct", name: "Support %", color: "hsl(var(--portal-accent-blue))" },
      ],
      data: [
        { candidate: "Daniel Biss", pct: 31.0 },
        { candidate: "Laura Fine", pct: 13.9 },
        { candidate: "Kat Abughazaleh", pct: 12.9 },
        { candidate: "Mike Simmons", pct: 8.2 },
        { candidate: "Bushra Amiwala", pct: 6.5 },
        { candidate: "Phil Andrew", pct: 3.7 },
        { candidate: "Hoan Huynh", pct: 1.6 },
        { candidate: "Jeff Cohen", pct: 0.6 },
        { candidate: "Sam Polan", pct: 0.1 },
        { candidate: "Undecided", pct: 21.3 },
      ],
      valueType: "percent",
    },

    // 2. Top Issues — Horizontal bar
    {
      type: "horizontal-bar",
      title: "Top Issues",
      description:
        "Most voters used both choices indicating high engagement. Top issues are centered on power and accountability.",
      xAxisKey: "issue",
      series: [
        { dataKey: "pct", name: "Selected %", color: "hsl(var(--portal-accent-purple))" },
      ],
      data: [
        { issue: "President has too much unchecked power", pct: 50.5 },
        { issue: "Billionaires/corps have too much power", pct: 42.5 },
        { issue: "ICE abusing power without accountability", pct: 42.1 },
        { issue: "Inflation and cost of living too high", pct: 20.5 },
        { issue: "Economy headed in wrong direction", pct: 9.5 },
        { issue: "Worried about job and future income", pct: 8.8 },
        { issue: "Healthcare unaffordable", pct: 8.3 },
      ],
      valueType: "percent",
    },

    // 3. AIPAC Support — Donut
    {
      type: "donut",
      title: "Impact of AIPAC/Pro-Israel Lobby Ties",
      description:
        "A clear majority say ties to AIPAC or the pro-Israel lobby make them less likely to support a candidate for Congress.",
      data: [
        { name: "Less Likely", value: 59.3, color: "#ef4444" },
        { name: "Neither", value: 30.2, color: "#94a3b8" },
        { name: "More Likely", value: 10.5, color: "#22c55e" },
      ],
    },

    // 4. Israel/Palestine Statements — Horizontal bar
    {
      type: "horizontal-bar",
      title: "Israel/Palestine: Strongly Agree Statements",
      description:
        "Voters show high engagement on human rights issues, with 41.4% strongly agreeing Israel is committing genocide.",
      xAxisKey: "statement",
      series: [
        { dataKey: "pct", name: "Strongly Agree %", color: "hsl(var(--portal-accent-blue))" },
      ],
      data: [
        { statement: "Israel is committing genocide", pct: 41.4 },
        { statement: "Israeli govt is extremist", pct: 35.1 },
        { statement: "Israel is an apartheid state", pct: 31.5 },
        { statement: "Sympathize more with Palestinians", pct: 30.2 },
        { statement: "Palestinian movement part of larger freedom movement", pct: 20.9 },
        { statement: "Israel is only Mideast democracy", pct: 12.4 },
        { statement: "Israel abiding by international law", pct: 8.8 },
        { statement: "Sympathize more with Israelis", pct: 4.7 },
      ],
      valueType: "percent",
    },
  ],

  methodology: {
    description:
      "This poll was conducted from February 15–20, 2026, among 638 likely Democratic primary voters in Illinois' 9th Congressional District. The margin of error is ±3.9% at 95% confidence. Results were weighted by Age, Gender, Race, and Primary Turnout Score to reflect the IL-09 Democratic primary electorate.",
    demographics: [
      {
        category: "Weighting Factors",
        breakdown: [
          { label: "Age", value: "Weighted" },
          { label: "Gender", value: "Weighted" },
          { label: "Race", value: "Weighted" },
          { label: "Primary Turnout Score", value: "Weighted" },
        ],
      },
    ],
    geographicNote:
      "Sample modeled and weighted to the IL-09 Congressional District Democratic primary electorate. The election is scheduled for March 17th, 2026.",
  },
};
