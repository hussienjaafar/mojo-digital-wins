import { Badge } from "@/components/ui/badge";
import { User, MapPin, Briefcase, Vote, Calendar, DollarSign, Phone, Mail } from "lucide-react";

interface DonorRow {
  identity_key: string;
  donor_email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  employer: string | null;
  occupation: string | null;
  age: number | null;
  gender: string | null;
  party_affiliation: string | null;
  voter_score: number | null;
  voter_file_matched: boolean | null;
  total_donated: number | null;
  donation_count: number | null;
  is_recurring: boolean | null;
  first_donation_date: string | null;
  last_donation_date: string | null;
  all_orgs: string[];
  crossover_count: number;
  channels: string[];
}

function Field({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

export function DonorUniverseDetail({ donor: d }: { donor: DonorRow }) {
  const formatDate = (v: string | null) => v ? new Date(v).toLocaleDateString() : null;

  return (
    <div className="bg-muted/20 border-t border-border px-6 py-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Personal Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Personal</h4>
          <Field icon={User} label="Name" value={[d.first_name, d.last_name].filter(Boolean).join(" ") || null} />
          <Field icon={Mail} label="Email" value={d.donor_email} />
          <Field icon={Phone} label="Phone" value={d.phone} />
          <Field icon={MapPin} label="Location" value={[d.address, d.city, d.state, d.zip].filter(Boolean).join(", ") || null} />
          {(d.age || d.gender) && (
            <Field icon={User} label="Demographics" value={[d.age ? `Age ${d.age}` : null, d.gender].filter(Boolean).join(", ") || null} />
          )}
        </div>

        {/* Donation Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Donations</h4>
          <Field icon={DollarSign} label="Total Donated" value={d.total_donated != null ? `$${d.total_donated.toLocaleString()}` : null} />
          <Field icon={DollarSign} label="# Donations" value={d.donation_count?.toString() || null} />
          <Field icon={Calendar} label="First Donation" value={formatDate(d.first_donation_date)} />
          <Field icon={Calendar} label="Last Donation" value={formatDate(d.last_donation_date)} />
          {d.is_recurring && (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
              Recurring Donor
            </Badge>
          )}
        </div>

        {/* Voter & Employment Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Voter & Employment</h4>
          <Field icon={Briefcase} label="Employer" value={d.employer} />
          <Field icon={Briefcase} label="Occupation" value={d.occupation} />
          <Field icon={Vote} label="Party" value={d.party_affiliation} />
          <Field icon={Vote} label="Voter Score" value={d.voter_score?.toString() || null} />
          {d.voter_file_matched && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-xs">
              Voter File Matched
            </Badge>
          )}

          {/* Orgs */}
          <div className="pt-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Organizations ({d.crossover_count})</h4>
            <div className="flex flex-wrap gap-1">
              {d.all_orgs?.map((org) => (
                <Badge key={org} variant="secondary" className="text-xs">{org}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
