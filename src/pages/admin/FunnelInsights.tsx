import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell } from 'recharts';

const STEP_ORDER = ['welcome', 'segment_select', 'commercial_opportunity', 'political_opportunity', 'commercial_proof', 'political_proof', 'qualification', 'thank_you'];
const STEP_LABELS: Record<string, string> = {
  welcome: 'Welcome',
  segment_select: 'Segment',
  commercial_opportunity: 'Opportunity',
  political_opportunity: 'Opportunity',
  commercial_proof: 'Social Proof',
  political_proof: 'Social Proof',
  qualification: 'Qualification',
  thank_you: 'Thank You',
};

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe'];

export default function FunnelInsights() {
  const [dateRange, setDateRange] = useState(7);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - dateRange);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Fetch step metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['funnel-step-metrics', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_step_metrics')
        .select('*')
        .gte('date', startDateStr)
        .order('step_number', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch variant performance
  const { data: variantPerf, isLoading: perfLoading } = useQuery({
    queryKey: ['funnel-variant-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_variant_performance')
        .select('*')
        .eq('is_active', true)
        .order('step_key', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch field interactions summary
  const { data: fieldData } = useQuery({
    queryKey: ['funnel-field-interactions', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funnel_field_interactions')
        .select('field_name, interaction_type, time_spent_ms, had_error')
        .gte('created_at', `${startDateStr}T00:00:00Z`);
      if (error) throw error;
      return data || [];
    },
  });

  // Aggregate conversion waterfall
  const waterfallData = (() => {
    if (!metrics || metrics.length === 0) return [];
    const byStep: Record<string, { views: number; completions: number }> = {};
    for (const m of metrics) {
      if (!byStep[m.step_key]) byStep[m.step_key] = { views: 0, completions: 0 };
      byStep[m.step_key].views += m.views;
      byStep[m.step_key].completions += m.completions;
    }
    return STEP_ORDER
      .filter(k => byStep[k])
      .map((k, i) => ({
        name: STEP_LABELS[k] || k,
        views: byStep[k].views,
        completions: byStep[k].completions,
        rate: byStep[k].views > 0 ? Math.round((byStep[k].completions / byStep[k].views) * 100) : 0,
        fill: COLORS[i % COLORS.length],
      }));
  })();

  // Field interaction summary
  const fieldSummary = (() => {
    if (!fieldData || fieldData.length === 0) return [];
    const byField: Record<string, { blurs: number; totalTime: number; errors: number }> = {};
    for (const f of fieldData) {
      if (f.interaction_type !== 'blur') continue;
      if (!byField[f.field_name]) byField[f.field_name] = { blurs: 0, totalTime: 0, errors: 0 };
      byField[f.field_name].blurs++;
      if (f.time_spent_ms) byField[f.field_name].totalTime += f.time_spent_ms;
      if (f.had_error) byField[f.field_name].errors++;
    }
    return Object.entries(byField).map(([name, d]) => ({
      name,
      avgTime: d.blurs > 0 ? Math.round(d.totalTime / d.blurs / 1000) : 0,
      errorRate: d.blurs > 0 ? Math.round((d.errors / d.blurs) * 100) : 0,
      interactions: d.blurs,
    })).sort((a, b) => b.avgTime - a.avgTime);
  })();

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-[#e2e8f0] p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Funnel Insights</h1>
          <p className="text-[#94a3b8] mt-1">Self-learning optimization dashboard</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDateRange(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateRange === d
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#141b2d] border border-[#1e2a45] text-[#94a3b8] hover:border-[#2d3b55]'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Conversion Waterfall */}
      <div className="bg-[#141b2d] border border-[#1e2a45] rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Step-by-Step Conversion Waterfall</h2>
        {metricsLoading ? (
          <div className="h-64 flex items-center justify-center text-[#64748b]">Loading...</div>
        ) : waterfallData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={waterfallData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2a45" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#141b2d', border: '1px solid #1e2a45', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }}
                formatter={(value: number, name: string) => [value, name === 'views' ? 'Views' : 'Completions']}
              />
              <Bar dataKey="views" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Views" />
              <Bar dataKey="completions" fill="#10b981" radius={[4, 4, 0, 0]} name="Completions" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-[#64748b]">
            No data yet — metrics will appear after the first daily computation
          </div>
        )}
      </div>

      {/* Variant Performance */}
      <div className="bg-[#141b2d] border border-[#1e2a45] rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Variant Performance (Thompson Sampling)</h2>
        {perfLoading ? (
          <div className="h-32 flex items-center justify-center text-[#64748b]">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#64748b] border-b border-[#1e2a45]">
                  <th className="text-left py-3 px-4">Step</th>
                  <th className="text-left py-3 px-4">Variant</th>
                  <th className="text-right py-3 px-4">Impressions</th>
                  <th className="text-right py-3 px-4">Conversions</th>
                  <th className="text-right py-3 px-4">Conv. Rate</th>
                  <th className="text-right py-3 px-4">Traffic Weight</th>
                  <th className="text-center py-3 px-4">Champion</th>
                </tr>
              </thead>
              <tbody>
                {(variantPerf || []).map(v => (
                  <tr key={v.id} className="border-b border-[#1e2a45]/50 hover:bg-[#1e2a45]/30">
                    <td className="py-3 px-4">{STEP_LABELS[v.step_key] || v.step_key}</td>
                    <td className="py-3 px-4 font-mono">{v.variant_label}</td>
                    <td className="py-3 px-4 text-right">{v.impressions.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">{v.conversions.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right">
                      {v.impressions > 0 ? `${((v.conversions / v.impressions) * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-[#1e2a45] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Number(v.traffic_weight) * 100}%` }}
                          />
                        </div>
                        <span className="text-[#94a3b8] text-xs w-10 text-right">
                          {(Number(v.traffic_weight) * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {v.is_champion && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                          👑 Champion
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Field-Level Drop-off Analysis */}
      <div className="bg-[#141b2d] border border-[#1e2a45] rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Qualification Form — Field Friction Analysis</h2>
        {fieldSummary.length > 0 ? (
          <div className="space-y-3">
            {fieldSummary.map(f => (
              <div key={f.name} className="flex items-center gap-4">
                <span className="text-[#94a3b8] w-32 text-sm capitalize">{f.name}</span>
                <div className="flex-1 h-6 bg-[#1e2a45] rounded-full overflow-hidden relative">
                  <div
                    className={`h-full rounded-full ${f.errorRate > 20 ? 'bg-red-500/60' : f.avgTime > 10 ? 'bg-amber-500/60' : 'bg-emerald-500/60'}`}
                    style={{ width: `${Math.min(100, f.avgTime * 5)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                    {f.avgTime}s avg · {f.errorRate}% errors · {f.interactions} interactions
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-[#64748b]">
            No field interaction data yet
          </div>
        )}
      </div>
    </div>
  );
}
