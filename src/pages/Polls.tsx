import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { polls } from "@/data/polls";
import { AnimateOnScroll } from "@/hooks/useIntersectionObserver";
import { BarChart3, Users, Calendar, ArrowRight } from "lucide-react";

const Polls = () => {
  return (
    <>
      <Helmet>
        <title>Community Pulse Polling | Molitico</title>
        <meta
          name="description"
          content="Data-driven polling insights from Molitico's Community Pulse division. Explore our published poll results and methodology."
        />
      </Helmet>

      <Navigation />

      <main className="min-h-screen bg-background">
        {/* Hero */}
        <section className="relative bg-primary text-primary-foreground py-20 sm:py-28 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--accent)/0.15),transparent_60%)]" />
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <AnimateOnScroll animation="slide-up">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-6 h-6 text-accent" />
                <span className="text-sm font-semibold tracking-widest uppercase text-accent">
                  Community Pulse
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-4 leading-tight">
                Polling Results<span className="text-accent">.</span>
              </h1>
              <p className="text-lg sm:text-xl text-primary-foreground/80 max-w-2xl">
                Data-driven insights for the progressive movement. Rigorous methodology, transparent results.
              </p>
            </AnimateOnScroll>
          </div>
        </section>

        {/* Poll Cards Grid */}
        <section className="py-16 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {polls.map((poll) => (
                <AnimateOnScroll key={poll.slug} animation="slide-up">
                  <Link
                    to={`/polls/${poll.slug}`}
                    className="group block rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm hover:shadow-lg hover:border-accent/40 transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      <Calendar className="w-3.5 h-3.5" />
                      {poll.date}
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 group-hover:text-accent transition-colors">
                      {poll.title}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      {poll.subtitle}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-5">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {poll.sampleSize.toLocaleString()} respondents
                      </span>
                      <span>±{poll.marginOfError}% MOE</span>
                    </div>

                    <p className="text-sm text-foreground/80 leading-relaxed mb-4 line-clamp-3">
                      {poll.keyFinding}
                    </p>

                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent group-hover:gap-2 transition-all">
                      View Results
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </Link>
                </AnimateOnScroll>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default Polls;
