import React from 'react';
import { AdPerformanceData } from '../../queries/useAdPerformanceQuery'; // Adjust path as needed
// Assuming these are available in a shared design system
import { V3Card } from '../../../design-system/V3Card'; 
import { V3MetricChip } from '../../../design-system/V3MetricChip';
import { V3Badge } from '../../../design-system/V3Badge'; 
import { ChevronDownIcon } from '@radix-ui/react-icons'; 
import * as Accordion from '@radix-ui/react-accordion'; 

// Simple utility for formatting currency and percentage for demonstration
const formatCurrency = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const formatPercentage = (value: number | undefined | null) => {
  if (value === undefined || value === null || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value / 100);
};

interface AdPerformanceCardProps {
  ad: AdPerformanceData;
}

export const AdPerformanceCard: React.FC<AdPerformanceCardProps> = ({ ad }) => {
  const isLowSpend = ad.spend < 50; // Example threshold for statistical caution

  // Determine badge variant for status
  const getStatusBadgeVariant = (status: AdPerformanceData['status']) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'PAUSED': return 'warning';
      case 'ARCHIVED': return 'default';
      default: return 'default';
    }
  };

  // Determine card accent based on performance tier
  const getCardAccent = (tier?: AdPerformanceData['performance_tier']) => {
    switch (tier) {
      case 'TOP_PERFORMER': return 'green';
      case 'STRONG': return 'blue';
      case 'NEEDS_IMPROVEMENT': return 'red';
      case 'AVERAGE': return 'amber';
      default: return 'default';
    }
  };

  return (
    <V3Card accent={getCardAccent(ad.performance_tier)} className="p-4 flex flex-col space-y-4">
      <div className="flex items-center space-x-4">
        {ad.creative_thumbnail_url && (
          <img
            src={ad.creative_thumbnail_url}
            alt={`Thumbnail for ${ad.ref_code}`}
            className="w-16 h-16 object-cover rounded"
          />
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{ad.ref_code}</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <V3Badge variant={getStatusBadgeVariant(ad.status)}>{ad.status}</V3Badge>
            {isLowSpend && (
              <V3Badge variant="info" tooltip="Statistical Caution: Results may not be significant due to low spend.">
                Low Spend <span className="ml-1">ⓘ</span>
              </V3Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <V3MetricChip label="Spend" value={formatCurrency(ad.spend)} />
        <V3MetricChip label="Raised" value={ad.raised !== undefined ? formatCurrency(ad.raised) : 'N/A'} />
        <V3MetricChip
          label="ROAS"
          value={ad.roas !== undefined && !isNaN(ad.roas) ? `${ad.roas.toFixed(2)}x` : 'N/A'}
          // Add tooltip for 0 Raised if ROAS is 0
          tooltip={ad.raised === 0 ? 'No attributed donations yet' : undefined}
        />
        {/* Only show CPA if it's a valid number and not infinity (e.g., spend > 0 and 0 conversions) */}
        {ad.cpa !== undefined && ad.cpa !== null && !isNaN(ad.cpa) && ad.cpa !== Infinity && (
          <V3MetricChip label="CPA" value={formatCurrency(ad.cpa)} />
        )}
        {ad.ctr !== undefined && !isNaN(ad.ctr) && <V3MetricChip label="CTR" value={formatPercentage(ad.ctr)} />}
        {ad.cpm !== undefined && !isNaN(ad.cpm) && <V3MetricChip label="CPM" value={formatCurrency(ad.cpm)} />}
        {/* Add more metrics as needed */}
      </div>

      <Accordion.Root type="single" collapsible>
        <Accordion.Item value="message-details">
          <Accordion.Header className="flex justify-between items-center w-full py-2 group">
            <h4 className="text-md font-medium">Message Details</h4>
            <ChevronDownIcon className="w-5 h-5 transition-transform duration-300 group-data-[state=open]:rotate-180" />
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=closed]:animate-slideUp data-[state=open]:animate-slideDown">
            <div className="pt-2">
              {/* MessagePerformanceView will go here when implemented */}
              <p className="text-sm text-gray-700">
                **Headline:** {ad.ad_copy_headline || 'N/A'}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                **Primary Text:** {ad.ad_copy_primary_text || 'N/A'}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                **Description:** {ad.ad_copy_description || 'N/A'}
              </p>
              {ad.performance_tier && (
                <V3Badge variant={getCardAccent(ad.performance_tier)} className="mt-2">
                  Performance Tier: {ad.performance_tier.replace(/_/g, ' ')}
                </V3Badge>
              )}
              {ad.key_themes && ad.key_themes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {ad.key_themes.map((theme, idx) => (
                    <V3Badge key={idx} variant="default">{theme}</V3Badge>
                  ))}
                </div>
              )}
            </div>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </V3Card>
  );
};
