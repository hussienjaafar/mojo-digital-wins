import type { PollData } from "./index";

export const va6Poll: PollData = {
  slug: "va-6-congressional-2026",
  title: "VA-6 Congressional District Poll",
  subtitle: "Proposed VA-6 Democratic Primary",
  date: "February 18–22, 2026",
  sponsor: "Unity & Justice Fund",
  sampleSize: 1031,
  marginOfError: 3,
  population: "Likely Democratic Primary Voters",
  keyFinding:
    "Wide open race — Rasoul gains +12.3 pts after voters learn about the candidates, closing the gap with Perriello while 20% remain undecided.",

  sections: [
    // 1. Ballot Test — Grouped horizontal bar
    {
      type: "grouped-bar",
      title: "Ballot Test: Initial vs. Post-Info",
      description:
        "The plurality of voters on the initial ballot are undecided. As voters learn more about Rasoul, he gains the most among the three candidates tested.",
      xAxisKey: "candidate",
      series: [
        { dataKey: "initial", name: "Initial Ballot", color: "hsl(var(--portal-accent-blue))" },
        { dataKey: "postInfo", name: "Post-Info Ballot", color: "hsl(var(--portal-accent-purple))" },
      ],
      data: [
        { candidate: "Tom Perriello", initial: 34.4, postInfo: 37.4 },
        { candidate: "Sam Rasoul", initial: 15.5, postInfo: 27.8 },
        { candidate: "Beth Macy", initial: 12.6, postInfo: 12.9 },
        { candidate: "Undecided", initial: 35.4, postInfo: 20.0 },
      ],
      shifts: {
        "Tom Perriello": "+3.0 pts",
        "Sam Rasoul": "+12.3 pts",
        "Beth Macy": "+0.3 pts",
        Undecided: "−15.4 pts",
      },
      valueType: "percent",
    },

    // 2. Rasoul Favorability — Stacked bar
    {
      type: "horizontal-bar",
      title: "Sam Rasoul Favorability",
      description:
        "Nearly 60% of voters in the district are familiar with Rasoul and he has an impressive +47% net favorability.",
      xAxisKey: "level",
      series: [
        { dataKey: "value", name: "Response %", color: "hsl(var(--portal-accent-blue))" },
      ],
      data: [
        { level: "Very Favorable", value: 27 },
        { level: "Somewhat Favorable", value: 22 },
        { level: "Neutral", value: 10 },
        { level: "Somewhat Unfavorable", value: 1 },
        { level: "Very Unfavorable", value: 1 },
      ],
      netLabel: "Net Favorability: +47%",
      valueType: "percent",
    },

    // 3. Candidate Type Preference — Donut
    {
      type: "donut",
      title: "Candidate Type Preference",
      description:
        "Nearly 50% of Democratic primary voters prefer a progressive candidate.",
      data: [
        { name: "Progressive", value: 48.4, color: "hsl(var(--portal-accent-blue))" },
        { name: "Experienced Leader", value: 39.3, color: "hsl(var(--portal-accent-purple))" },
        { name: "Political Outsider", value: 12.3, color: "#94a3b8" },
      ],
    },

    // 4. Progressive Figure Favorability — Horizontal bar
    {
      type: "horizontal-bar",
      title: "Progressive Figure Favorability",
      description:
        "Voters hold overwhelmingly positive views of prominent national progressives.",
      xAxisKey: "figure",
      series: [
        { dataKey: "totalFav", name: "Total Favorable %", color: "hsl(var(--portal-accent-blue))" },
      ],
      data: [
        { figure: "Elizabeth Warren", totalFav: 84.1 },
        { figure: "Bernie Sanders", totalFav: 82.8 },
        { figure: "Alexandria Ocasio-Cortez", totalFav: 78.9 },
      ],
      valueType: "percent",
    },
  ],

  methodology: {
    description:
      "This poll was conducted from February 18–22, 2026, among 1,031 likely Democratic primary voters in Virginia's newly proposed 6th Congressional District. The margin of error is ±3%. Results were weighted to reflect the demographic composition of the VA-6 Democratic primary electorate.",
    demographics: [
      {
        category: "Gender",
        breakdown: [
          { label: "Female", value: "60%" },
          { label: "Male", value: "40%" },
        ],
      },
      {
        category: "Race / Ethnicity",
        breakdown: [
          { label: "White", value: "80%" },
          { label: "Black", value: "8.5%" },
          { label: "Hispanic", value: "2.5%" },
          { label: "Asian", value: "2%" },
          { label: "Other", value: "7%" },
        ],
      },
      {
        category: "Age",
        breakdown: [
          { label: "18–19", value: "0.7%" },
          { label: "20–24", value: "3.1%" },
          { label: "25–29", value: "3.9%" },
          { label: "30–34", value: "4.9%" },
          { label: "35–39", value: "5.9%" },
          { label: "40–44", value: "5.9%" },
          { label: "45–49", value: "5.4%" },
          { label: "50–54", value: "5.1%" },
          { label: "55–64", value: "14.6%" },
          { label: "65+", value: "50.7%" },
        ],
      },
    ],
    geographicNote:
      "Geographic weighting was applied based on county/city share of the VA-6 electorate, with Albemarle County (24.9%), Charlottesville City (15.4%), and Roanoke City (12.2%) representing the three largest jurisdictions.",
  },
};
