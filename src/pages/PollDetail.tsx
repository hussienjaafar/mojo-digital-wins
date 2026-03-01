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
import { useIsMobile } from "@/hooks/use-mobile";
import {
  BarChart3,
  Users,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";

// ─── Visible description subtitle inside chart cards ─────────
const SectionDescription = ({ text }: { text?: string }) => {
  if (!text) return null;
  return (
    <p className="text-xs sm:text-sm text-[hsl(var(--portal-text-secondary))] mb-4 leading-relaxed">
      {text}
    </p>
  );
};

// ─── Section Renderers ───────────────────────────────────────

const GroupedBar = ({ section, isMobile }: { section: GroupedBarSection; isMobile: boolean }) => (
  <V3ChartWrapper
    title={section.title}
    icon={BarChart3}
    ariaLabel={section.title}
    description={section.description}
    accent="blue"
  >
    <SectionDescription text={section.description} />
    <EChartsBarChart
      data={section.data}
      xAxisKey={section.xAxisKey}
      series={section.series}
      horizontal
      valueType={section.valueType}
      height={Math.max(240, section.data.length * 56)}
      showLegend
      gridLeft={8}
      showBarLabels
      hideValueAxis
      inverseCategoryAxis
      xAxisLabelFormatter={(v: string) => {
        const max = isMobile ? 20 : 30;
        if (v.length <= max) return v;
        const mid = v.lastIndexOf(' ', max);
        if (mid === -1) return v.slice(0, max - 2) + '…';
        return v.slice(0, mid) + '\n' + v.slice(mid + 1);
      }}
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
    <SectionDescription text={section.description} />
    <EChartsBarChart
      data={section.data}
      xAxisKey={section.xAxisKey}
      series={section.series}
      horizontal
      valueType={section.valueType}
      height={140}
      showLegend
      showBarLabels
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

const Donut = ({ section, isMobile }: { section: DonutSection; isMobile: boolean }) => (
  <V3ChartWrapper
    title={section.title}
    icon={Users}
    ariaLabel={section.title}
    description={section.description}
    accent="purple"
  >
    <SectionDescription text={section.description} />
    <EChartsPieChart
      data={section.data}
      variant="donut"
      height={isMobile ? 320 : 360}
      showLabels
      showLegend
      valueType="percent"
      showPercentage
      labelThreshold={5}
    />
  </V3ChartWrapper>
);

const HorizontalBar = ({ section, isMobile }: { section: HorizontalBarSection; isMobile: boolean }) => (
  <V3ChartWrapper
    title={section.title}
    icon={BarChart3}
    ariaLabel={section.title}
    description={section.description}
    accent="blue"
  >
    <SectionDescription text={section.description} />
    <EChartsBarChart
      data={section.data}
      xAxisKey={section.xAxisKey}
      series={section.series}
      horizontal
      valueType={section.valueType}
      height={Math.max(200, section.data.length * 36)}
      showLegend={false}
      gridLeft={8}
      showBarLabels
      inverseCategoryAxis
      hideValueAxis
      xAxisLabelFormatter={(v: string) => {
        const max = isMobile ? 20 : 30;
        if (v.length <= max) return v;
        const mid = v.lastIndexOf(' ', max);
        if (mid === -1) return v.slice(0, max - 2) + '…';
        return v.slice(0, mid) + '\n' + v.slice(mid + 1);
      }}
    />
  </V3ChartWrapper>
);

const SectionRenderer = ({ section, isMobile }: { section: PollSection; isMobile: boolean }) => {
  switch (section.type) {
    case "grouped-bar":
      return <GroupedBar section={section} isMobile={isMobile} />;
    case "stacked-bar":
      return <StackedBar section={section} />;
    case "donut":
      return <Donut section={section} isMobile={isMobile} />;
    case "horizontal-bar":
      return <HorizontalBar section={section} isMobile={isMobile} />;
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
  const isMobile = useIsMobile();

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
            <div className="portal-theme dark space-y-8 max-w-5xl mx-auto">
              {poll.sections.map((section, i) => (
                <AnimateOnScroll key={i} animation="slide-up">
                  <SectionRenderer section={section} isMobile={isMobile} />
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
