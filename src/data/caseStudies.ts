import { TrendingUp, Users, DollarSign, Target } from "lucide-react";
import unityJusticeImage from "@/assets/unity-justice-fund.png";
import abdulSenateImage from "@/assets/abdul-senate.png";
import nasserMichiganImage from "@/assets/nasser-michigan.webp";
import rashidIllinoisImage from "@/assets/rashid-illinois.jpg";

export interface CaseStudy {
  id: string;
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
  timeline?: string;
  challenge?: string;
  solution?: string;
  results?: string[];
  video?: string;
  testimonial?: {
    quote: string;
    author: string;
    role: string;
  };
}

export const caseStudies: CaseStudy[] = [
  {
    id: "unity-justice-fund",
    title: "Unity & Justice Fund",
    category: "501C(4)",
    stat: "947% ROI",
    description: "Six-month strategic partnership supporting Zohran Mamdani's NYC mayoral campaign through comprehensive digital organizing, fundraising, and paid media. Leveraging a database of hundreds of thousands of Muslim donors for targeted outreach.",
    metrics: [
      { icon: TrendingUp, label: "947% ROI", value: "947%" },
      { icon: DollarSign, label: "$270K Raised", value: "$270K" },
      { icon: DollarSign, label: "$45K/Month Avg", value: "$45K" },
      { icon: Users, label: "6 Month Campaign", value: "6 mo" },
    ],
    image: unityJusticeImage,
    featured: true,
    timeline: "6 Months (Ongoing)",
    video: "https://player.vimeo.com/video/1134692415?title=0&byline=0&portrait=0",
    challenge: "Unity & Justice Fund, a 501(c)(4) organization, needed a comprehensive digital strategy to elevate Zohran Mamdani's NYC mayoral candidacy in a crowded field. They required sustained fundraising, voter outreach, and persuasion campaigns while building name recognition across diverse communities. Traditional political consultants couldn't deliver the culturally competent targeting and sustained grassroots engagement needed.",
    solution: "We became Unity & Justice Fund's full-service digital partner, executing an integrated 6-month campaign combining fundraising, advocacy, and paid persuasion. Our strategy included: high-velocity SMS and email campaigns averaging $45K/month in fundraising; Meta advertising promoting Zohran and running contrast ads against his main opponent; strategic billboard placements in key NYC neighborhoods; and sophisticated audience targeting leveraging our proprietary database of hundreds of thousands of Muslim donors nationwide for precise demographic and psychographic segmentation.",
    results: [
      "Raised over $270,000 across 6 months ($45K monthly average)",
      "Executed integrated paid media strategy across digital and outdoor channels",
      "Deployed targeted SMS, email, and Meta ad campaigns",
      "Leveraged database of hundreds of thousands of Muslim donors for precision targeting",
      "Ran pro-Mamdani promotional content and strategic contrast advertising",
      "Placed high-visibility billboards supporting Zohran's candidacy",
      "Built sustained grassroots momentum throughout the campaign",
      "Significantly increased name recognition and favorability in key demographics"
    ],
    testimonial: {
      quote: "Mojo Digital became an essential part of our campaign infrastructure. Their ability to reach and mobilize our community while consistently delivering fundraising results has been transformative for our efforts to elect Zohran.",
      author: "Campaign Leadership",
      role: "Unity & Justice Fund"
    }
  },
  {
    id: "abdul-senate",
    title: "Abdul for U.S. Senate",
    category: "Senate",
    stat: "257% ROI",
    description: "Effective Senate campaign leveraging targeted outreach and compelling messaging to drive grassroots support.",
    metrics: [
      { icon: TrendingUp, label: "257% ROI", value: "257%" },
      { icon: DollarSign, label: "$55.98 Avg", value: "$55.98" },
    ],
    image: abdulSenateImage,
    timeline: "3 Months",
    video: "https://player.vimeo.com/video/1134747644?title=0&byline=0&portrait=0",
    challenge: "A first-time Senate candidate needed to build name recognition and a donor base from scratch in a crowded primary field. Traditional political consultants quoted 6-month timelines—we had half that time.",
    solution: "We built a comprehensive digital acquisition strategy combining Meta and Google ads with high-conversion email sequences. Our creative testing identified the most compelling narratives, and we scaled winning ads aggressively while maintaining strict cost-per-acquisition targets.",
    results: [
      "257% return on ad spend",
      "$55.98 average donation across all channels",
      "Built a sustainable donor file from zero",
      "30% email open rate with 12% click-through",
      "Helped secure primary victory in competitive race"
    ]
  },
  {
    id: "nasser-michigan",
    title: "Nasser for Michigan",
    category: "Senate",
    stat: "325% ROI",
    description: "Delivered strong ROI with high average donation through compelling narrative-driven email strategy and targeted digital advertising.",
    metrics: [
      { icon: TrendingUp, label: "325% ROI", value: "325%" },
      { icon: DollarSign, label: "$129.56 Avg", value: "$129.56" },
    ],
    featured: true,
    timeline: "4 Months",
    video: "https://player.vimeo.com/video/1134749340?title=0&byline=0&portrait=0",
    image: nasserMichiganImage,
    challenge: "Running in a diverse district, the campaign needed to reach multiple communities with tailored messaging while maintaining fundraising efficiency. Previous digital efforts had plateaued with declining returns.",
    solution: "We developed culturally resonant creative for each community segment while maintaining a unified progressive vision. Our email program told the candidate's story through compelling long-form narratives that educated and inspired, rather than just asking for money.",
    results: [
      "325% ROI across all digital channels",
      "$129.56 average donation—one of the highest in the race",
      "Doubled email list size in 4 months",
      "42% of donors were first-time political contributors",
      "Maintained profitability while scaling to $50K+/week in ad spend"
    ],
    testimonial: {
      quote: "Their deep understanding of our diverse community and ability to craft authentic messaging made all the difference. We raised more than we thought possible.",
      author: "Campaign Manager",
      role: "Nasser for Michigan"
    }
  },
  {
    id: "preston-pa",
    title: "Preston For PA",
    category: "Congressional",
    stat: "236% ROI",
    description: "Scaled Congressional campaign through strategic digital programs, adding over 2,300 new grassroots supporters.",
    metrics: [
      { icon: TrendingUp, label: "236% ROI", value: "236%" },
      { icon: Users, label: "2,349 New Donors", value: "2,349" },
      { icon: DollarSign, label: "$29.11 Avg", value: "$29.11" },
    ],
    timeline: "6 Weeks",
    challenge: "A grassroots Congressional campaign needed rapid donor growth to prove viability to major progressive organizations. With limited name recognition outside the district, every dollar had to work harder.",
    solution: "We focused on hyper-local targeting combined with broader progressive messaging to build a coalition. Our acquisition campaigns prioritized volume of donors over donation size, building the grassroots army that unlocked endorsements and matching funds.",
    results: [
      "236% return on investment",
      "2,349 new donors added to campaign",
      "$29.11 average donation optimized for maximum participation",
      "Donor growth helped secure DCCC Red to Blue designation",
      "Built foundation for successful general election fundraising"
    ]
  },
  {
    id: "rashid-illinois",
    title: "Rashid for Illinois",
    category: "Local",
    stat: "415% ROI",
    description: "Ongoing digital fundraising partnership managing SMS and paid advertising campaigns. Maintaining consistent high-performance results with 415% ROI and strong grassroots donor growth over 3 months.",
    metrics: [
      { icon: TrendingUp, label: "415% ROI", value: "415%" },
      { icon: Users, label: "5,250+ New Donors", value: "5,250+" },
      { icon: DollarSign, label: "$46.51 Avg", value: "$46.51" },
      { icon: Target, label: "3 Month Campaign", value: "3 months" },
    ],
    image: rashidIllinoisImage,
    featured: true,
    timeline: "3 Months (Ongoing)",
    video: "https://player.vimeo.com/video/1134923340?title=0&byline=0&portrait=0",
    challenge: "State Rep. Rashid needed a comprehensive digital fundraising operation to support his ongoing campaign efforts. The campaign required consistent donor acquisition, sustained engagement, and efficient conversion across multiple channels while maintaining profitability.",
    solution: "We became the campaign's full-service digital fundraising partner, executing an integrated SMS and paid advertising strategy. Our approach combines targeted Meta and Google ads for donor acquisition with high-conversion SMS sequences for engagement and re-solicitation. We maintain strict ROI targets while continuously testing and optimizing creative, audiences, and messaging.",
    results: [
      "Sustained 415% return on investment over 3 months",
      "Acquired 5,250+ new donors and counting",
      "$46.51 average donation maintained across all channels",
      "Consistent monthly donor growth through optimized acquisition",
      "High-performance SMS program driving repeat contributions",
      "Profitable paid media strategy with ongoing optimization",
      "Built sustainable fundraising infrastructure for long-term success"
    ],
    testimonial: {
      quote: "When we came to Mojo Digital, we were behind and running out of time. They didn't just meet our goal—they exceeded it and built us a donor base that carried us to victory.",
      author: "State Rep. Rashid",
      role: "Illinois State Representative"
    }
  },
  {
    id: "arab-american-nonprofit",
    title: "Arab-American Non-profit",
    category: "501C(3)",
    stat: "304% ROI",
    description: "Exceptional donor acquisition for nonprofit organization, bringing in nearly 6,000 new supporters with compelling community-focused messaging.",
    metrics: [
      { icon: TrendingUp, label: "304% ROI", value: "304%" },
      { icon: Users, label: "5,909 New Donors", value: "5,909" },
      { icon: DollarSign, label: "$95.79 Avg", value: "$95.79" },
    ],
    timeline: "8 Months",
    challenge: "A growing nonprofit needed to expand beyond their traditional donor base to fund ambitious new programs. They were heavily reliant on major donors and needed sustainable grassroots support.",
    solution: "We built a multi-channel acquisition program that told the organization's impact story through real community voices. By showcasing tangible results and connecting donors to specific programs, we made giving personal and meaningful.",
    results: [
      "304% ROI on digital fundraising investment",
      "5,909 new donors—expanding reach by 340%",
      "$95.79 average donation",
      "Monthly recurring donor program grew 520%",
      "Reduced dependence on major donors from 75% to 45% of revenue",
      "Built sustainable fundraising foundation for growth"
    ]
  },
  {
    id: "new-policy",
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
    timeline: "1 Month",
    challenge: "A new advocacy organization needed to build an initial donor base to fund their first major campaign. With no existing email list or brand recognition, they were starting from absolute zero.",
    solution: "We created a bold acquisition campaign focused on the urgency of their issue advocacy work. By partnering with aligned organizations for initial audience targeting and developing scroll-stopping creative, we built awareness and trust simultaneously.",
    results: [
      "289% return on investment in first month",
      "502 founding donors acquired",
      "$84.26 average donation",
      "Built email list to 8,000+ engaged subscribers",
      "Established sustainable monthly giving program",
      "Created foundation for ongoing policy campaigns"
    ],
    testimonial: {
      quote: "Mojo Digital helped us build our organization from the ground up. Their strategic approach gave us the resources and the community we needed to make real policy change.",
      author: "Founding Director",
      role: "A New Policy"
    }
  },
];

export const featuredCaseStudies = caseStudies.filter(study => study.featured);
