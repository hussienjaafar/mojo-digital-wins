import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { format } from "date-fns";

type Props = {
  organizationId: string;
  startDate: string;
  endDate: string;
};

type Transaction = {
  id: string;
  transaction_id: string;
  donor_name: string;
  amount: number;
  refcode: string | null;
  source_campaign: string | null;
  transaction_type: string;
  is_recurring: boolean;
  transaction_date: string;
};

const DonationMetrics = ({ organizationId, startDate, endDate }: Props) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [organizationId, startDate, endDate]);

  useEffect(() => {
    if (searchTerm) {
      setFilteredTransactions(
        transactions.filter(t =>
          t.donor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.refcode?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    } else {
      setFilteredTransactions(transactions);
    }
  }, [searchTerm, transactions]);

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
      setFilteredTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const totalAmount = filteredTransactions
    .filter(t => t.transaction_type === 'donation')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const avgDonation = filteredTransactions.length > 0 ? totalAmount / filteredTransactions.length : 0;
  const recurringCount = filteredTransactions.filter(t => t.is_recurring).length;

  if (isLoading) {
    return <div className="text-center py-8">Loading donation data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalAmount.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Donations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredTransactions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Donation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgDonation.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recurring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recurringCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by donor, transaction ID, or refcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Donor</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Refcode</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Recurring</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.slice(0, 100).map(transaction => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {format(new Date(transaction.transaction_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="font-medium">{transaction.donor_name}</TableCell>
                    <TableCell>${Number(transaction.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={transaction.transaction_type === 'donation' ? 'default' : 'secondary'}>
                        {transaction.transaction_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {transaction.refcode || '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {transaction.source_campaign || '-'}
                    </TableCell>
                    <TableCell>
                      {transaction.is_recurring && (
                        <Badge variant="outline">Recurring</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default DonationMetrics;
