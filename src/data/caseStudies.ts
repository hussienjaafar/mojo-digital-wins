import { TrendingUp, Users, DollarSign, Target } from "lucide-react";
import unityJusticeImage from "@/assets/unity-justice-fund.png";

export interface CaseStudy {
  title: string;
  category: "Senate" | "Congressional" | "Local" | "PACs" | "501C(3)" | "501C(4)";
  stat: string;
  description: string;
  metrics: Array<{
    icon: typeof TrendingUp | typeof Users | typeof DollarSign | typeof Target;
    label: string;
    value: string;
  }>;
  image?: string;
  featured?: boolean;
}

export const caseStudies: CaseStudy[] = [
  {
    title: "Unity & Justice Fund",
    category: "PACs",
    stat: "947% ROI",
    description: "Generated $45K in 48 hours with high-urgency fundraising message and personal storytelling. Achieved exceptional ROI through targeted SMS campaigns.",
    metrics: [
      { icon: TrendingUp, label: "947% ROI", value: "947%" },
      { icon: Users, label: "490 New Donors", value: "490" },
      { icon: DollarSign, label: "$144.60 Avg", value: "$144.60" },
    ],
    image: unityJusticeImage,
    featured: true,
  },
  {
    title: "Abdul for U.S. Senate",
    category: "Senate",
    stat: "257% ROI",
    description: "Effective Senate campaign leveraging targeted outreach and compelling messaging to drive grassroots support.",
    metrics: [
      { icon: TrendingUp, label: "257% ROI", value: "257%" },
      { icon: DollarSign, label: "$55.98 Avg", value: "$55.98" },
    ],
  },
  {
    title: "Nasser for Michigan",
    category: "Senate",
    stat: "325% ROI",
    description: "Delivered strong ROI with high average donation through compelling narrative-driven email strategy and targeted digital advertising.",
    metrics: [
      { icon: TrendingUp, label: "325% ROI", value: "325%" },
      { icon: DollarSign, label: "$129.56 Avg", value: "$129.56" },
    ],
    featured: true,
  },
  {
    title: "Preston For PA",
    category: "Congressional",
    stat: "236% ROI",
    description: "Scaled Congressional campaign through strategic digital programs, adding over 2,300 new grassroots supporters.",
    metrics: [
      { icon: TrendingUp, label: "236% ROI", value: "236%" },
      { icon: Users, label: "2,349 New Donors", value: "2,349" },
      { icon: DollarSign, label: "$29.11 Avg", value: "$29.11" },
    ],
  },
  {
    title: "Rashid for Illinois",
    category: "Local",
    stat: "415% ROI",
    description: "Scaled grassroots campaign through targeted digital acquisition and conversion-optimized email program, adding 875 new donors in just 2 weeks.",
    metrics: [
      { icon: TrendingUp, label: "415% ROI", value: "415%" },
      { icon: Users, label: "875 New Donors", value: "875" },
      { icon: DollarSign, label: "$46.51 Avg", value: "$46.51" },
      { icon: Target, label: "2 Week Sprint", value: "2 weeks" },
    ],
    featured: true,
  },
  {
    title: "Arab-American Non-profit",
    category: "501C(3)",
    stat: "304% ROI",
    description: "Exceptional donor acquisition for nonprofit organization, bringing in nearly 6,000 new supporters with compelling community-focused messaging.",
    metrics: [
      { icon: TrendingUp, label: "304% ROI", value: "304%" },
      { icon: Users, label: "5,909 New Donors", value: "5,909" },
      { icon: DollarSign, label: "$95.79 Avg", value: "$95.79" },
    ],
  },
  {
    title: "A New Policy",
    category: "501C(4)",
    stat: "289% ROI",
    description: "One-month advocacy campaign delivering strong returns through targeted issue-based messaging and strategic donor outreach.",
    metrics: [
      { icon: TrendingUp, label: "289% ROI", value: "289%" },
      { icon: Users, label: "502 New Donors", value: "502" },
      { icon: DollarSign, label: "$84.26 Avg", value: "$84.26" },
      { icon: Target, label: "1 Month Timeline", value: "1 month" },
    ],
  },
];

export const featuredCaseStudies = caseStudies.filter(study => study.featured);
