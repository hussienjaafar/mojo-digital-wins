import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, MessageSquare, Image, Plus, Trash2, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  V3Card, 
  V3CardHeader, 
  V3CardTitle, 
  V3CardDescription, 
  V3CardContent, 
  V3Button 
} from "@/components/v3";
import { iconSizes } from "@/lib/design-tokens";

type Props = {
  organizationId: string;
  onImportComplete?: () => void;
};

type SMSEntry = {
  campaign_name: string;
  message_text: string;
  send_date: string;
  messages_sent: number;
  messages_delivered: number;
  clicks: number;
  conversions: number;
  amount_raised: number;
};

type MetaEntry = {
  campaign_name: string;
  primary_text: string;
  headline: string;
  creative_type: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
};

const DEFAULT_SMS: SMSEntry = {
  campaign_name: "",
  message_text: "",
  send_date: new Date().toISOString().split("T")[0],
  messages_sent: 0,
  messages_delivered: 0,
  clicks: 0,
  conversions: 0,
  amount_raised: 0,
};

const DEFAULT_META: MetaEntry = {
  campaign_name: "",
  primary_text: "",
  headline: "",
  creative_type: "image",
  impressions: 0,
  clicks: 0,
  spend: 0,
  conversions: 0,
  conversion_value: 0,
};

export function CreativeDataImport({ organizationId, onImportComplete }: Props) {
  const [activeTab, setActiveTab] = useState("sms");
  const [smsEntries, setSmsEntries] = useState<SMSEntry[]>([{ ...DEFAULT_SMS }]);
  const [metaEntries, setMetaEntries] = useState<MetaEntry[]>([{ ...DEFAULT_META }]);
  const [isImporting, setIsImporting] = useState(false);
  const [csvText, setCsvText] = useState("");

  const addSmsEntry = () => setSmsEntries([...smsEntries, { ...DEFAULT_SMS }]);
  const addMetaEntry = () => setMetaEntries([...metaEntries, { ...DEFAULT_META }]);

  const removeSmsEntry = (index: number) => {
    if (smsEntries.length > 1) {
      setSmsEntries(smsEntries.filter((_, i) => i !== index));
    }
  };

  const removeMetaEntry = (index: number) => {
    if (metaEntries.length > 1) {
      setMetaEntries(metaEntries.filter((_, i) => i !== index));
    }
  };

  const updateSmsEntry = (index: number, field: keyof SMSEntry, value: any) => {
    const updated = [...smsEntries];
    updated[index] = { ...updated[index], [field]: value };
    setSmsEntries(updated);
  };

  const updateMetaEntry = (index: number, field: keyof MetaEntry, value: any) => {
    const updated = [...metaEntries];
    updated[index] = { ...updated[index], [field]: value };
    setMetaEntries(updated);
  };

  const parseCSV = (text: string, type: "sms" | "meta") => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      toast.error("CSV must have a header row and at least one data row");
      return;
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

    if (type === "sms") {
      const entries: SMSEntry[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const entry: any = { ...DEFAULT_SMS };

        headers.forEach((header, idx) => {
          const value = values[idx] || "";
          if (header.includes("campaign") || header.includes("name")) entry.campaign_name = value;
          else if (header.includes("message") || header.includes("text")) entry.message_text = value;
          else if (header.includes("date")) entry.send_date = value || new Date().toISOString().split("T")[0];
          else if (header.includes("sent")) entry.messages_sent = parseInt(value) || 0;
          else if (header.includes("delivered")) entry.messages_delivered = parseInt(value) || 0;
          else if (header.includes("click")) entry.clicks = parseInt(value) || 0;
          else if (header.includes("conversion")) entry.conversions = parseInt(value) || 0;
          else if (header.includes("amount") || header.includes("raised") || header.includes("revenue"))
            entry.amount_raised = parseFloat(value) || 0;
        });

        if (entry.message_text) entries.push(entry);
      }
      setSmsEntries(entries.length > 0 ? entries : [{ ...DEFAULT_SMS }]);
      toast.success(`Parsed ${entries.length} SMS entries`);
    } else {
      const entries: MetaEntry[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map((v) => v.trim());
        const entry: any = { ...DEFAULT_META };

        headers.forEach((header, idx) => {
          const value = values[idx] || "";
          if (header.includes("campaign") || header.includes("name")) entry.campaign_name = value;
          else if (header.includes("primary") || header.includes("body")) entry.primary_text = value;
          else if (header.includes("headline")) entry.headline = value;
          else if (header.includes("type")) entry.creative_type = value || "image";
          else if (header.includes("impression")) entry.impressions = parseInt(value) || 0;
          else if (header.includes("click")) entry.clicks = parseInt(value) || 0;
          else if (header.includes("spend") || header.includes("cost")) entry.spend = parseFloat(value) || 0;
          else if (header.includes("conversion") && !header.includes("value"))
            entry.conversions = parseInt(value) || 0;
          else if (header.includes("value") || header.includes("revenue"))
            entry.conversion_value = parseFloat(value) || 0;
        });

        if (entry.primary_text || entry.headline) entries.push(entry);
      }
      setMetaEntries(entries.length > 0 ? entries : [{ ...DEFAULT_META }]);
      toast.success(`Parsed ${entries.length} Meta entries`);
    }

    setCsvText("");
  };

  const handleImport = async () => {
    setIsImporting(true);

    try {
      if (activeTab === "sms") {
        const validEntries = smsEntries.filter((e) => e.message_text.trim());
        if (validEntries.length === 0) {
          toast.error("Please add at least one SMS with message text");
          return;
        }

        const insertData = validEntries.map((e) => ({
          organization_id: organizationId,
          campaign_id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          campaign_name: e.campaign_name || "Imported Campaign",
          message_text: e.message_text,
          send_date: e.send_date,
          messages_sent: e.messages_sent,
          messages_delivered: e.messages_delivered,
          clicks: e.clicks,
          conversions: e.conversions,
          amount_raised: e.amount_raised,
          click_rate: e.messages_delivered > 0 ? e.clicks / e.messages_delivered : 0,
          conversion_rate: e.clicks > 0 ? e.conversions / e.clicks : 0,
        }));

        const { error } = await supabase.from("sms_creative_insights").insert(insertData);

        if (error) throw error;

        toast.success(`Imported ${validEntries.length} SMS creatives`);
        setSmsEntries([{ ...DEFAULT_SMS }]);

        // Trigger analysis
        supabase.functions.invoke("analyze-sms-creatives", {
          body: { organization_id: organizationId },
        });
      } else {
        const validEntries = metaEntries.filter((e) => e.primary_text.trim() || e.headline.trim());
        if (validEntries.length === 0) {
          toast.error("Please add at least one Meta ad with text content");
          return;
        }

        const insertData = validEntries.map((e) => ({
          organization_id: organizationId,
          campaign_id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          campaign_name: e.campaign_name || "Imported Campaign",
          primary_text: e.primary_text,
          headline: e.headline,
          creative_type: e.creative_type,
          impressions: e.impressions,
          clicks: e.clicks,
          spend: e.spend,
          conversions: e.conversions,
          conversion_value: e.conversion_value,
          ctr: e.impressions > 0 ? e.clicks / e.impressions : 0,
          conversion_rate: e.clicks > 0 ? e.conversions / e.clicks : 0,
          roas: e.spend > 0 ? e.conversion_value / e.spend : 0,
        }));

        const { error } = await supabase.from("meta_creative_insights").insert(insertData);

        if (error) throw error;

        toast.success(`Imported ${validEntries.length} Meta creatives`);
        setMetaEntries([{ ...DEFAULT_META }]);

        // Trigger analysis
        supabase.functions.invoke("analyze-meta-creatives", {
          body: { organization_id: organizationId },
        });
      }

      onImportComplete?.();
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Failed to import data");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <V3Card>
      <V3CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
            <Upload className={cn(iconSizes.md, "text-[hsl(var(--portal-accent-blue))]")} />
          </div>
          <div>
            <V3CardTitle>Import Campaign Data</V3CardTitle>
            <V3CardDescription>
              Add your SMS and Meta ad performance data to generate AI insights
            </V3CardDescription>
          </div>
        </div>
      </V3CardHeader>
      <V3CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-[hsl(var(--portal-bg-secondary))]">
            <TabsTrigger value="sms" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-primary))]">
              <MessageSquare className={iconSizes.sm} />
              SMS Data
            </TabsTrigger>
            <TabsTrigger value="meta" className="gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-primary))]">
              <Image className={iconSizes.sm} />
              Meta Ads
            </TabsTrigger>
          </TabsList>

          {/* CSV Import Section */}
          <div className="mb-6 p-4 border border-[hsl(var(--portal-border))] rounded-lg bg-[hsl(var(--portal-bg-elevated))]">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className={iconSizes.sm} />
              <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Paste CSV Data</span>
            </div>
            <Textarea
              placeholder={
                activeTab === "sms"
                  ? "campaign_name,message_text,send_date,messages_sent,messages_delivered,clicks,conversions,amount_raised\nMy Campaign,Your message here...,2024-01-01,1000,950,45,12,1200"
                  : "campaign_name,primary_text,headline,creative_type,impressions,clicks,spend,conversions,conversion_value\nMy Campaign,Ad body text...,Ad Headline,image,10000,150,500,25,2500"
              }
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="mb-2 font-mono text-xs h-24 border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
            />
            <V3Button
              size="sm"
              variant="outline"
              onClick={() => parseCSV(csvText, activeTab as "sms" | "meta")}
              disabled={!csvText.trim()}
            >
              Parse CSV
            </V3Button>
          </div>

          <TabsContent value="sms" className="space-y-4">
            {smsEntries.map((entry, index) => (
              <div key={index} className="p-4 border border-[hsl(var(--portal-border))] rounded-lg space-y-3 bg-[hsl(var(--portal-bg-card))]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">SMS #{index + 1}</span>
                  {smsEntries.length > 1 && (
                    <V3Button variant="ghost" size="icon-sm" onClick={() => removeSmsEntry(index)}>
                      <Trash2 className={cn(iconSizes.sm, "text-[hsl(var(--portal-error))]")} />
                    </V3Button>
                  )}
                </div>

                <div className="grid gap-3">
                  <div>
                    <Label htmlFor={`sms-name-${index}`} className="text-[hsl(var(--portal-text-primary))]">Campaign Name</Label>
                    <Input
                      id={`sms-name-${index}`}
                      value={entry.campaign_name}
                      onChange={(e) => updateSmsEntry(index, "campaign_name", e.target.value)}
                      placeholder="Q4 Fundraising Push"
                      className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`sms-text-${index}`} className="text-[hsl(var(--portal-text-primary))]">Message Text *</Label>
                    <Textarea
                      id={`sms-text-${index}`}
                      value={entry.message_text}
                      onChange={(e) => updateSmsEntry(index, "message_text", e.target.value)}
                      placeholder="URGENT: Your donation TODAY could change everything..."
                      className="h-20 border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <Label htmlFor={`sms-date-${index}`} className="text-[hsl(var(--portal-text-primary))]">Send Date</Label>
                      <Input
                        id={`sms-date-${index}`}
                        type="date"
                        value={entry.send_date}
                        onChange={(e) => updateSmsEntry(index, "send_date", e.target.value)}
                        className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`sms-sent-${index}`} className="text-[hsl(var(--portal-text-primary))]">Sent</Label>
                      <Input
                        id={`sms-sent-${index}`}
                        type="number"
                        value={entry.messages_sent}
                        onChange={(e) => updateSmsEntry(index, "messages_sent", parseInt(e.target.value) || 0)}
                        className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`sms-delivered-${index}`} className="text-[hsl(var(--portal-text-primary))]">Delivered</Label>
                      <Input
                        id={`sms-delivered-${index}`}
                        type="number"
                        value={entry.messages_delivered}
                        onChange={(e) => updateSmsEntry(index, "messages_delivered", parseInt(e.target.value) || 0)}
                        className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`sms-clicks-${index}`} className="text-[hsl(var(--portal-text-primary))]">Clicks</Label>
                      <Input
                        id={`sms-clicks-${index}`}
                        type="number"
                        value={entry.clicks}
                        onChange={(e) => updateSmsEntry(index, "clicks", parseInt(e.target.value) || 0)}
                        className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`sms-conv-${index}`} className="text-[hsl(var(--portal-text-primary))]">Conversions</Label>
                      <Input
                        id={`sms-conv-${index}`}
                        type="number"
                        value={entry.conversions}
                        onChange={(e) => updateSmsEntry(index, "conversions", parseInt(e.target.value) || 0)}
                        className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`sms-amount-${index}`} className="text-[hsl(var(--portal-text-primary))]">Amount Raised ($)</Label>
                      <Input
                        id={`sms-amount-${index}`}
                        type="number"
                        step="0.01"
                        value={entry.amount_raised}
                        onChange={(e) => updateSmsEntry(index, "amount_raised", parseFloat(e.target.value) || 0)}
                        className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <V3Button variant="outline" onClick={addSmsEntry} className="w-full gap-2">
              <Plus className={iconSizes.sm} />
              Add Another SMS
            </V3Button>
          </TabsContent>

          <TabsContent value="meta" className="space-y-4">
            {metaEntries.map((entry, index) => (
              <div key={index} className="p-4 border border-[hsl(var(--portal-border))] rounded-lg space-y-3 bg-[hsl(var(--portal-bg-card))]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Meta Ad #{index + 1}</span>
                  {metaEntries.length > 1 && (
                    <V3Button variant="ghost" size="icon-sm" onClick={() => removeMetaEntry(index)}>
                      <Trash2 className={cn(iconSizes.sm, "text-[hsl(var(--portal-error))]")} />
                    </V3Button>
                  )}
                </div>

                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`meta-name-${index}`} className="text-[hsl(var(--portal-text-primary))]">Campaign Name</Label>
                      <Input
                        id={`meta-name-${index}`}
                        value={entry.campaign_name}
                        onChange={(e) => updateMetaEntry(index, "campaign_name", e.target.value)}
                        placeholder="FB Acquisition Q4"
                        className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`meta-type-${index}`} className="text-[hsl(var(--portal-text-primary))]">Creative Type</Label>
                      <select
                        id={`meta-type-${index}`}
                        value={entry.creative_type}
                        onChange={(e) => updateMetaEntry(index, "creative_type", e.target.value)}
                        className="w-full h-10 px-3 border border-[hsl(var(--portal-border))] rounded-md bg-[hsl(var(--portal-bg-primary))] text-[hsl(var(--portal-text-primary))]"
                      >
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="carousel">Carousel</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`meta-headline-${index}`} className="text-[hsl(var(--portal-text-primary))]">Headline</Label>
                    <Input
                      id={`meta-headline-${index}`}
                      value={entry.headline}
                      onChange={(e) => updateMetaEntry(index, "headline", e.target.value)}
                      placeholder="Double Your Impact Today!"
                      className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`meta-text-${index}`} className="text-[hsl(var(--portal-text-primary))]">Primary Text *</Label>
                    <Textarea
                      id={`meta-text-${index}`}
                      value={entry.primary_text}
                      onChange={(e) => updateMetaEntry(index, "primary_text", e.target.value)}
                      placeholder="Every dollar you give today will be matched..."
                      className="h-20 border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                    />
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    <div>
                      <Label htmlFor={`meta-impressions-${index}`} className="text-[hsl(var(--portal-text-primary))]">Impressions</Label>
                      <Input
                        id={`meta-impressions-${index}`}
                        type="number"
                        value={entry.impressions}
                        onChange={(e) => updateMetaEntry(index, "impressions", parseInt(e.target.value) || 0)}
                        className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`meta-clicks-${index}`} className="text-[hsl(var(--portal-text-primary))]">Clicks</Label>
                      <Input
                        id={`meta-clicks-${index}`}
                        type="number"
                        value={entry.clicks}
                        onChange={(e) => updateMetaEntry(index, "clicks", parseInt(e.target.value) || 0)}
                        className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`meta-spend-${index}`} className="text-[hsl(var(--portal-text-primary))]">Spend ($)</Label>
                      <Input
                        id={`meta-spend-${index}`}
                        type="number"
                        step="0.01"
                        value={entry.spend}
                        onChange={(e) => updateMetaEntry(index, "spend", parseFloat(e.target.value) || 0)}
                        className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`meta-conv-${index}`} className="text-[hsl(var(--portal-text-primary))]">Conv.</Label>
                      <Input
                        id={`meta-conv-${index}`}
                        type="number"
                        value={entry.conversions}
                        onChange={(e) => updateMetaEntry(index, "conversions", parseInt(e.target.value) || 0)}
                        className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`meta-value-${index}`} className="text-[hsl(var(--portal-text-primary))]">Value ($)</Label>
                      <Input
                        id={`meta-value-${index}`}
                        type="number"
                        step="0.01"
                        value={entry.conversion_value}
                        onChange={(e) => updateMetaEntry(index, "conversion_value", parseFloat(e.target.value) || 0)}
                        className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-primary))]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <V3Button variant="outline" onClick={addMetaEntry} className="w-full gap-2">
              <Plus className={iconSizes.sm} />
              Add Another Meta Ad
            </V3Button>
          </TabsContent>

          {/* Import Button */}
          <div className="mt-6 pt-4 border-t border-[hsl(var(--portal-border))]">
            <V3Button 
              onClick={handleImport} 
              isLoading={isImporting}
              loadingText="Importing..."
              className="w-full"
            >
              <Upload className={iconSizes.sm} />
              Import {activeTab === "sms" ? "SMS" : "Meta"} Data
            </V3Button>
          </div>
        </Tabs>
      </V3CardContent>
    </V3Card>
  );
}
