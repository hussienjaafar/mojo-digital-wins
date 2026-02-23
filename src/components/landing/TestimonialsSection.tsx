import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const testimonials = [
  {
    quote: "The audience intelligence report completely changed our media strategy. We saw a 3x improvement in ROAS within the first quarter.",
    name: "Campaign Director",
    title: "National Political Campaign",
  },
  {
    quote: "Being able to activate across CTV, digital, and direct mail from one dataset gave us consistency we never had before.",
    name: "VP of Marketing",
    title: "Consumer Packaged Goods Brand",
  },
  {
    quote: "The match rates are genuinely best-in-class. We're reaching more of our target universe than with any other vendor.",
    name: "Media Buyer",
    title: "Issue Advocacy Organization",
  },
];

const TestimonialsSection = () => {
  const { ref, isVisible } = useScrollAnimation({ startVisible: false });

  return (
    <section ref={ref} className="py-20 px-4 bg-[#0a0f1a]">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-[#e2e8f0] mb-3">What Our Partners Say</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              className="p-6 rounded-2xl border border-[#1e2a45] bg-[#141b2d]/60 flex flex-col"
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: i * 0.12 }}
            >
              <Quote className="h-8 w-8 text-blue-500/20 mb-4 flex-shrink-0" />
              <p className="text-[#94a3b8] text-sm leading-relaxed mb-6 flex-grow">"{t.quote}"</p>
              <div>
                <div className="text-[#e2e8f0] font-semibold text-sm">{t.name}</div>
                <div className="text-[#64748b] text-xs">{t.title}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
