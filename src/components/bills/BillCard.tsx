import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ExternalLink, Users, Calendar, TrendingUp, Eye, AlertTriangle, Clock, Scale } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface BillCardProps {
  bill: {
    id: string;
    bill_number: string;
    bill_type: string;
    title: string;
    current_status: string | null;
    sponsor_name: string | null;
    sponsor_party: string | null;
    sponsor_state: string | null;
    cosponsor_count: number | null;
    cosponsor_party_breakdown: Record<string, number> | null;
    latest_action_date: string | null;
    latest_action_text: string | null;
    committee_assignments: string[] | null;
    related_bills: string[] | null;
    bill_text_url: string | null;
    congress: number;
    relevance_score: number | null;
    introduced_date: string | null;
  };
}

// Calculate threat level from relevance score
const getThreatLevel = (score: number | null): string => {
  if (!score) return 'low';
  if (score >= 50) return 'critical';
  if (score >= 30) return 'high';
  if (score >= 15) return 'medium';
  return 'low';
};

const THREAT_COLORS: Record<string, string> = {
  'critical': 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
  'high': 'border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20',
  'medium': 'border-l-4 border-l-yellow-500',
  'low': '',
};

const THREAT_BADGE_COLORS: Record<string, string> = {
  'critical': 'bg-red-500 text-white',
  'high': 'bg-orange-500 text-white',
  'medium': 'bg-yellow-500 text-black',
  'low': 'bg-gray-200 text-gray-700',
};

// Check if bill has bipartisan support
const isBipartisan = (breakdown: Record<string, number> | null): boolean => {
  if (!breakdown) return false;
  const parties = Object.keys(breakdown);
  return parties.includes('D') && parties.includes('R');
};

// Generate Congress.gov URL from bill data
const getCongressGovUrl = (billNumber: string, billType: string, congress: number): string => {
  const numberOnly = billNumber.replace(/[^0-9]/g, '');
  const typeMap: Record<string, string> = {
    'hr': 'house-bill',
    's': 'senate-bill',
    'hjres': 'house-joint-resolution',
    'sjres': 'senate-joint-resolution',
    'hconres': 'house-concurrent-resolution',
    'sconres': 'senate-concurrent-resolution',
    'hres': 'house-resolution',
    'sres': 'senate-resolution',
  };
  const urlType = typeMap[billType.toLowerCase()] || billType;
  return `https://www.congress.gov/bill/${congress}th-congress/${urlType}/${numberOnly}`;
};

const STATUS_STEPS = {
  'introduced': { label: 'Introduced', progress: 10, color: 'bg-blue-500' },
  'in_committee': { label: 'In Committee', progress: 30, color: 'bg-yellow-500' },
  'passed_house': { label: 'Passed House', progress: 50, color: 'bg-orange-500' },
  'passed_senate': { label: 'Passed Senate', progress: 50, color: 'bg-orange-500' },
  'passed_both': { label: 'Passed Both Chambers', progress: 75, color: 'bg-green-500' },
  'enacted': { label: 'Enacted', progress: 100, color: 'bg-emerald-600' },
  'vetoed': { label: 'Vetoed', progress: 100, color: 'bg-red-500' },
};

const PARTY_COLORS: Record<string, string> = {
  'D': 'bg-blue-600',
  'R': 'bg-red-600',
  'I': 'bg-purple-600',
};

export function BillCard({ bill }: BillCardProps) {
  const statusInfo = STATUS_STEPS[(bill.current_status || 'introduced') as keyof typeof STATUS_STEPS] || STATUS_STEPS.introduced;
  const threatLevel = getThreatLevel(bill.relevance_score);
  const threatStyle = THREAT_COLORS[threatLevel] || '';
  const congressGovUrl = getCongressGovUrl(bill.bill_number, bill.bill_type, bill.congress);

  return (
    <Card className={`hover:shadow-lg transition-shadow ${threatStyle}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {/* Threat Level Badge - Prominent */}
              <Badge className={THREAT_BADGE_COLORS[threatLevel]}>
                {threatLevel === 'critical' && <AlertTriangle className="w-3 h-3 mr-1" />}
                {threatLevel.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="font-mono">
                {bill.bill_number}
              </Badge>
              {/* Bipartisan Indicator */}
              {isBipartisan(bill.cosponsor_party_breakdown) && (
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                  <Scale className="w-3 h-3 mr-1" />
                  Bipartisan
                </Badge>
              )}
            </div>
            <CardTitle className="text-base leading-tight line-clamp-2">{bill.title}</CardTitle>
            {/* Time Info */}
            {bill.introduced_date && (
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Introduced {formatDistanceToNow(new Date(bill.introduced_date), { addSuffix: true })}
                </span>
                {bill.latest_action_date && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Updated {formatDistanceToNow(new Date(bill.latest_action_date), { addSuffix: true })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{statusInfo.label}</span>
            <span className="text-muted-foreground">{statusInfo.progress}%</span>
          </div>
          <Progress value={statusInfo.progress} className="h-2" />
        </div>

        {/* Sponsor Info */}
        {bill.sponsor_name && (
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">Sponsor:</span>
            <span>{bill.sponsor_name}</span>
            {bill.sponsor_party && (
              <Badge 
                variant="outline" 
                className={`${PARTY_COLORS[bill.sponsor_party]} text-white border-0`}
              >
                {bill.sponsor_party}-{bill.sponsor_state}
              </Badge>
            )}
          </div>
        )}

        {/* Cosponsors */}
        {bill.cosponsor_count && bill.cosponsor_count > 0 && (
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">Cosponsors:</span>
              <span className="text-muted-foreground">{bill.cosponsor_count} total</span>
            </div>
            {bill.cosponsor_party_breakdown && (
              <div className="flex gap-2">
                {Object.entries(bill.cosponsor_party_breakdown).map(([party, count]) => (
                  <Badge
                    key={party}
                    variant="outline"
                    className={`text-xs ${PARTY_COLORS[party]} text-white border-0`}
                  >
                    {party}: {count}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Latest Action */}
        {bill.latest_action_text && (
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>
                {bill.latest_action_date && format(new Date(bill.latest_action_date), 'MMM d, yyyy')}
              </span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {bill.latest_action_text}
            </p>
          </div>
        )}

        {/* Committees */}
        {bill.committee_assignments && bill.committee_assignments.length > 0 && (
          <div className="text-sm">
            <span className="font-medium">Committees:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {bill.committee_assignments.slice(0, 3).map((committee, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {committee}
                </Badge>
              ))}
              {bill.committee_assignments.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{bill.committee_assignments.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Related Bills */}
        {bill.related_bills && bill.related_bills.length > 0 && (
          <div className="text-sm">
            <span className="font-medium">Related Bills:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {bill.related_bills.slice(0, 3).map((relatedBill, i) => (
                <Badge key={i} variant="outline" className="text-xs font-mono">
                  {relatedBill}
                </Badge>
              ))}
              {bill.related_bills.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{bill.related_bills.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            asChild
          >
            <Link to={`/bills/${bill.bill_number}`} className="flex items-center justify-center gap-2">
              <Eye className="w-4 h-4" />
              View Details
            </Link>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            asChild
          >
            <a
              href={congressGovUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Congress.gov
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
