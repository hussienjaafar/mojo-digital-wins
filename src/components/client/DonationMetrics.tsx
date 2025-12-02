import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { PortalCard, PortalCardContent, PortalCardHeader, PortalCardTitle } from "@/components/portal/PortalCard";
import { PortalMetric } from "@/components/portal/PortalMetric";
import { PortalBadge } from "@/components/portal/PortalBadge";
import { Input } from "@/components/ui/input";
import { Search, DollarSign, Users, Repeat, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { logger } from "@/lib/logger";
import { PortalTable, PortalTableRenderers } from "@/components/portal/PortalTable";
import { NoResultsEmptyState } from "@/components/portal/PortalEmptyState";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type Transaction = {
  id: string;
  transaction_id: string;
  donor_name: string;
  donor_email: string;
  amount: number;
  refcode: string | null;
  source_campaign: string | null;
  transaction_type: string;
  is_recurring: boolean;
  transaction_date: string;
};

const DonationMetrics = ({ organizationId, startDate, endDate }: Props) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [organizationId, startDate, endDate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('actblue_transactions')
        .select('*')
        .eq('organization_id', organizationId)
        .gte('transaction_date', startDate)
        .lte('transaction_date', endDate)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      logger.error('Failed to load transactions', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return transactions;
    return transactions.filter(t =>
      t.donor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.refcode?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, transactions]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const donations = filteredTransactions.filter(t => t.transaction_type === 'donation');
    const totalAmount = donations.reduce((sum, t) => sum + Number(t.amount), 0);
    const avgDonation = donations.length > 0 ? totalAmount / donations.length : 0;
    const recurringCount = donations.filter(t => t.is_recurring).length;
    const recurringPercentage = donations.length > 0 ? (recurringCount / donations.length) * 100 : 0;
    const uniqueDonors = new Set(donations.map(d => d.donor_email)).size;

    return {
      totalAmount,
      donationCount: donations.length,
      avgDonation,
      recurringCount,
      recurringPercentage,
      uniqueDonors,
    };
  }, [filteredTransactions]);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <PortalMetric
          label="Total Raised"
          value={`$${metrics.totalAmount.toLocaleString()}`}
          icon={DollarSign}
          subtitle={`${metrics.donationCount} donations`}
        />
        <PortalMetric
          label="Unique Donors"
          value={metrics.uniqueDonors.toLocaleString()}
          icon={Users}
          subtitle="Individual contributors"
        />
        <PortalMetric
          label="Avg Donation"
          value={`$${metrics.avgDonation.toFixed(2)}`}
          icon={TrendingUp}
          subtitle="Per transaction"
        />
        <PortalMetric
          label="Recurring"
          value={`${metrics.recurringPercentage.toFixed(0)}%`}
          icon={Repeat}
          subtitle={`${metrics.recurringCount} sustainers`}
        />
      </div>

      {/* Transactions Table */}
      <PortalCard>
        <PortalCardHeader>
          <PortalCardTitle>Recent Transactions</PortalCardTitle>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 portal-text-muted" />
            <Input
              placeholder="Search by donor, transaction ID, or refcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 portal-input"
            />
          </div>
        </PortalCardHeader>
        <PortalCardContent>
          <PortalTable
            data={filteredTransactions.slice(0, 100)}
            columns={[
              {
                key: "transaction_date",
                label: "Date",
                sortable: true,
                render: (value) => (
                  <span className="portal-text-secondary text-sm">
                    {format(new Date(value), 'MMM d, yyyy')}
                  </span>
                ),
              },
              {
                key: "donor_name",
                label: "Donor",
                sortable: true,
                render: (value) => <span className="font-medium portal-text-primary">{value}</span>,
              },
              {
                key: "amount",
                label: "Amount",
                sortable: true,
                className: "text-right",
                render: (value) => (
                  <span className="font-semibold portal-text-primary">
                    {PortalTableRenderers.currency(Number(value))}
                  </span>
                ),
              },
              {
                key: "transaction_type",
                label: "Type",
                mobileLabel: "Type",
                render: (value) => (
                  <PortalBadge variant={value === 'donation' ? 'success' : 'neutral'}>
                    {value}
                  </PortalBadge>
                ),
              },
              {
                key: "refcode",
                label: "Refcode",
                className: "text-sm portal-text-secondary",
                render: (value) => value || '-',
                hiddenOnMobile: true,
              },
              {
                key: "source_campaign",
                label: "Source",
                className: "text-sm portal-text-secondary",
                render: (value) => value || '-',
                hiddenOnMobile: true,
              },
              {
                key: "is_recurring",
                label: "Recurring",
                mobileLabel: "Recurring",
                render: (value) => value ? (
                  <PortalBadge variant="info" icon={Repeat}>Recurring</PortalBadge>
                ) : null,
              },
            ]}
            keyExtractor={(row) => row.id}
            isLoading={isLoading}
            emptyMessage={searchTerm ? "No transactions match your search" : "No transactions found"}
            emptyAction={
              searchTerm ? (
                <NoResultsEmptyState onClear={() => setSearchTerm("")} />
              ) : (
                <p className="text-sm portal-text-muted">
                  Transactions will appear here once donations are received
                </p>
              )
            }
          />
        </PortalCardContent>
      </PortalCard>
    </div>
  );
};

export default DonationMetrics;