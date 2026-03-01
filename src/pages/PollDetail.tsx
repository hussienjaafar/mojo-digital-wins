import { useParams, Navigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { getPollBySlug } from "@/data/polls";
import type {
  PollSection,
  GroupedBarSection,
  StackedBarSection,
  DonutSection,
  HorizontalBarSection,
  MethodologyData,
  DemographicRow,
} from "@/data/polls";
import { V3ChartWrapper } from "@/components/v3/V3ChartWrapper";
import { EChartsBarChart } from "@/components/charts/echarts";
import { EChartsPieChart } from "@/components/charts/echarts";
import { AnimateOnScroll } from "@/hooks/useIntersectionObserver";
import {
  BarChart3,
  Users,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

// ─── Section Renderers ───────────────────────────────────────

const GroupedBar = ({ section }: { section: GroupedBarSection }) => (
  <V3ChartWrapper
    title={section.title}
    icon={BarChart3}
    ariaLabel={section.title}
    description={section.description}
    accent="blue"
  >
    <EChartsBarChart
      data={section.data}
      xAxisKey={section.xAxisKey}
      series={section.series}
      horizontal
      valueType={section.valueType}
      height={280}
      showLegend
    />
    {section.shifts && (
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(section.shifts).map(([name, shift]) => (
          <div
            key={name}
            className="rounded-lg bg-[hsl(var(--portal-bg-elevated))] px-3 py-2 text-center"
          >
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">{name}</p>
            <p className="text-sm font-bold text-[hsl(var(--portal-text-primary))]">
              {shift}
            </p>
          </div>
        ))}
      </div>
    )}
  </V3ChartWrapper>
);

const StackedBar = ({ section }: { section: StackedBarSection }) => (
  <V3ChartWrapper
    title={section.title}
    icon={BarChart3}
    ariaLabel={section.title}
    description={section.description}
    accent="green"
  >
    <EChartsBarChart
      data={section.data}
      xAxisKey={section.xAxisKey}
      series={section.series}
      horizontal
      valueType={section.valueType}
      height={140}
      showLegend
    />
    {section.netLabel && (
      <div className="mt-3 text-center">
        <span className="inline-block rounded-full bg-[hsl(var(--portal-accent-blue)/0.12)] px-4 py-1.5 text-sm font-bold text-[hsl(var(--portal-accent-blue))]">
          {section.netLabel}
        </span>
      </div>
    )}
  </V3ChartWrapper>
);

const Donut = ({ section }: { section: DonutSection }) => (
  <V3ChartWrapper
    title={section.title}
    icon={Users}
    ariaLabel={section.title}
    description={section.description}
    accent="purple"
  >
    <EChartsPieChart
      data={section.data}
      variant="donut"
      height={320}
      showLabels
      showLegend
      valueType="percent"
      showPercentage
    />
  </V3ChartWrapper>
);

const HorizontalBar = ({ section }: { section: HorizontalBarSection }) => (
  <V3ChartWrapper
    title={section.title}
    icon={BarChart3}
    ariaLabel={section.title}
    description={section.description}
    accent="blue"
  >
    <EChartsBarChart
      data={section.data}
      xAxisKey={section.xAxisKey}
      series={section.series}
      horizontal
      valueType={section.valueType}
      height={220}
      showLegend={false}
    />
  </V3ChartWrapper>
);

const SectionRenderer = ({ section }: { section: PollSection }) => {
  switch (section.type) {
    case "grouped-bar":
      return <GroupedBar section={section} />;
    case "stacked-bar":
      return <StackedBar section={section} />;
    case "donut":
      return <Donut section={section} />;
    case "horizontal-bar":
      return <HorizontalBar section={section} />;
    default:
      return null;
  }
};

// ─── Methodology ─────────────────────────────────────────────

const DemographicTable = ({ rows }: { rows: DemographicRow[] }) => (
  <div className="space-y-4">
    {rows.map((row) => (
      <div key={row.category}>
        <h5 className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--portal-text-muted))] mb-2">
          {row.category}
        </h5>
        <div className="flex flex-wrap gap-2">
          {row.breakdown.map((item) => (
            <span
              key={item.label}
              className="rounded-md bg-[hsl(var(--portal-bg-elevated))] px-3 py-1.5 text-xs text-[hsl(var(--portal-text-primary))]"
            >
              <span className="font-medium">{item.label}:</span>{" "}
              <span className="text-[hsl(var(--portal-text-secondary))]">{item.value}</span>
            </span>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const MethodologySection = ({ methodology }: { methodology: MethodologyData }) => (
  <V3ChartWrapper
    title="Methodology"
    icon={AlertTriangle}
    ariaLabel="Poll methodology details"
    accent="default"
  >
    <p className="text-sm text-[hsl(var(--portal-text-secondary))] mb-6 leading-relaxed">
      {methodology.description}
    </p>
    <DemographicTable rows={methodology.demographics} />
    {methodology.geographicNote && (
      <p className="mt-4 text-xs text-[hsl(var(--portal-text-muted))] italic leading-relaxed">
        {methodology.geographicNote}
      </p>
    )}
  </V3ChartWrapper>
);

// ─── Page ────────────────────────────────────────────────────

const PollDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const poll = slug ? getPollBySlug(slug) : undefined;

  if (!poll) {
    return <Navigate to="/polls" replace />;
  }

  return (
    <>
      <Helmet>
        <title>{poll.title} | Molitico Polling</title>
        <meta name="description" content={poll.keyFinding} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: poll.title,
            description: poll.keyFinding,
            datePublished: "2026-02-22",
            creator: { "@type": "Organization", name: "Molitico" },
          })}
        </script>
      </Helmet>

      <Navigation />

      <main className="min-h-screen bg-background">
        {/* Header */}
        <section className="relative bg-primary text-primary-foreground py-16 sm:py-24 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--accent)/0.15),transparent_60%)]" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <Link
              to="/polls"
              className="inline-flex items-center gap-1 text-sm text-primary-foreground/60 hover:text-accent transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              All Polls
            </Link>

            <AnimateOnScroll animation="slide-up">
              <div className="flex flex-wrap items-center gap-3 mb-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground/60">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {poll.date}
                </span>
                <span className="text-primary-foreground/30">|</span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {poll.sampleSize.toLocaleString()} {poll.population}
                </span>
                <span className="text-primary-foreground/30">|</span>
                <span>±{poll.marginOfError}% MOE</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-3 leading-tight">
                {poll.title}
                <span className="text-accent">.</span>
              </h1>
              <p className="text-sm text-primary-foreground/60">
                Sponsored by {poll.sponsor}
              </p>
            </AnimateOnScroll>
          </div>
        </section>

        {/* Key Finding */}
        <section className="py-8 sm:py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <AnimateOnScroll animation="slide-up">
              <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6 sm:p-8">
                <div className="flex items-start gap-3">
                  <ChevronRight className="w-5 h-5 text-accent mt-0.5 shrink-0" />
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-accent mb-2">
                      Key Finding
                    </h2>
                    <p className="text-base sm:text-lg text-foreground leading-relaxed">
                      {poll.keyFinding}
                    </p>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </section>

        {/* Chart Sections — wrapped in portal-theme dark for V3 tokens */}
        <section className="pb-16 sm:pb-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="portal-theme dark space-y-8">
              {poll.sections.map((section, i) => (
                <AnimateOnScroll key={i} animation="slide-up">
                  {section.description && (
                    <p className="text-sm text-[hsl(var(--portal-text-secondary))] mb-3 max-w-3xl">
                      {section.description}
                    </p>
                  )}
                  <SectionRenderer section={section} />
                </AnimateOnScroll>
              ))}

              {/* Methodology */}
              <AnimateOnScroll animation="slide-up">
                <MethodologySection methodology={poll.methodology} />
              </AnimateOnScroll>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default PollDetail;
