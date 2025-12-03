import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, MessageSquare, Image, Plus, Trash2, Sparkles, FileSpreadsheet } from "lucide-react";

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
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Upload className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Import Campaign Data</CardTitle>
            <CardDescription>
              Add your SMS and Meta ad performance data to generate AI insights
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="sms" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS Data
            </TabsTrigger>
            <TabsTrigger value="meta" className="gap-2">
              <Image className="h-4 w-4" />
              Meta Ads
            </TabsTrigger>
          </TabsList>

          {/* CSV Import Section */}
          <div className="mb-6 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="text-sm font-medium">Paste CSV Data</span>
            </div>
            <Textarea
              placeholder={
                activeTab === "sms"
                  ? "campaign_name,message_text,send_date,messages_sent,messages_delivered,clicks,conversions,amount_raised\nMy Campaign,Your message here...,2024-01-01,1000,950,45,12,1200"
                  : "campaign_name,primary_text,headline,creative_type,impressions,clicks,spend,conversions,conversion_value\nMy Campaign,Ad body text...,Ad Headline,image,10000,150,500,25,2500"
              }
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="mb-2 font-mono text-xs h-24"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => parseCSV(csvText, activeTab as "sms" | "meta")}
              disabled={!csvText.trim()}
            >
              Parse CSV
            </Button>
          </div>

          <TabsContent value="sms" className="space-y-4">
            {smsEntries.map((entry, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">SMS #{index + 1}</span>
                  {smsEntries.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeSmsEntry(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3">
                  <div>
                    <Label htmlFor={`sms-name-${index}`}>Campaign Name</Label>
                    <Input
                      id={`sms-name-${index}`}
                      value={entry.campaign_name}
                      onChange={(e) => updateSmsEntry(index, "campaign_name", e.target.value)}
                      placeholder="Q4 Fundraising Push"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`sms-text-${index}`}>Message Text *</Label>
                    <Textarea
                      id={`sms-text-${index}`}
                      value={entry.message_text}
                      onChange={(e) => updateSmsEntry(index, "message_text", e.target.value)}
                      placeholder="URGENT: Your donation TODAY could change everything..."
                      className="h-20"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <Label htmlFor={`sms-date-${index}`}>Send Date</Label>
                      <Input
                        id={`sms-date-${index}`}
                        type="date"
                        value={entry.send_date}
                        onChange={(e) => updateSmsEntry(index, "send_date", e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`sms-sent-${index}`}>Sent</Label>
                      <Input
                        id={`sms-sent-${index}`}
                        type="number"
                        value={entry.messages_sent}
                        onChange={(e) => updateSmsEntry(index, "messages_sent", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`sms-delivered-${index}`}>Delivered</Label>
                      <Input
                        id={`sms-delivered-${index}`}
                        type="number"
                        value={entry.messages_delivered}
                        onChange={(e) => updateSmsEntry(index, "messages_delivered", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`sms-clicks-${index}`}>Clicks</Label>
                      <Input
                        id={`sms-clicks-${index}`}
                        type="number"
                        value={entry.clicks}
                        onChange={(e) => updateSmsEntry(index, "clicks", parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`sms-conv-${index}`}>Conversions</Label>
                      <Input
                        id={`sms-conv-${index}`}
                        type="number"
                        value={entry.conversions}
                        onChange={(e) => updateSmsEntry(index, "conversions", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`sms-amount-${index}`}>Amount Raised ($)</Label>
                      <Input
                        id={`sms-amount-${index}`}
                        type="number"
                        step="0.01"
                        value={entry.amount_raised}
                        onChange={(e) => updateSmsEntry(index, "amount_raised", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addSmsEntry} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Add Another SMS
            </Button>
          </TabsContent>

          <TabsContent value="meta" className="space-y-4">
            {metaEntries.map((entry, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Meta Ad #{index + 1}</span>
                  {metaEntries.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeMetaEntry(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`meta-name-${index}`}>Campaign Name</Label>
                      <Input
                        id={`meta-name-${index}`}
                        value={entry.campaign_name}
                        onChange={(e) => updateMetaEntry(index, "campaign_name", e.target.value)}
                        placeholder="FB Acquisition Q4"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`meta-type-${index}`}>Creative Type</Label>
                      <select
                        id={`meta-type-${index}`}
                        value={entry.creative_type}
                        onChange={(e) => updateMetaEntry(index, "creative_type", e.target.value)}
                        className="w-full h-10 px-3 border rounded-md bg-background"
                      >
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="carousel">Carousel</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor={`meta-text-${index}`}>Primary Text *</Label>
                    <Textarea
                      id={`meta-text-${index}`}
                      value={entry.primary_text}
                      onChange={(e) => updateMetaEntry(index, "primary_text", e.target.value)}
                      placeholder="We're at a critical moment..."
                      className="h-20"
                    />
                  </div>

                  <div>
                    <Label htmlFor={`meta-headline-${index}`}>Headline</Label>
                    <Input
                      id={`meta-headline-${index}`}
                      value={entry.headline}
                      onChange={(e) => updateMetaEntry(index, "headline", e.target.value)}
                      placeholder="Donate Now - Make a Difference"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <Label htmlFor={`meta-imp-${index}`}>Impressions</Label>
                      <Input
                        id={`meta-imp-${index}`}
                        type="number"
                        value={entry.impressions}
                        onChange={(e) => updateMetaEntry(index, "impressions", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`meta-clicks-${index}`}>Clicks</Label>
                      <Input
                        id={`meta-clicks-${index}`}
                        type="number"
                        value={entry.clicks}
                        onChange={(e) => updateMetaEntry(index, "clicks", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`meta-spend-${index}`}>Spend ($)</Label>
                      <Input
                        id={`meta-spend-${index}`}
                        type="number"
                        step="0.01"
                        value={entry.spend}
                        onChange={(e) => updateMetaEntry(index, "spend", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`meta-conv-${index}`}>Conversions</Label>
                      <Input
                        id={`meta-conv-${index}`}
                        type="number"
                        value={entry.conversions}
                        onChange={(e) => updateMetaEntry(index, "conversions", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`meta-value-${index}`}>Value ($)</Label>
                      <Input
                        id={`meta-value-${index}`}
                        type="number"
                        step="0.01"
                        value={entry.conversion_value}
                        onChange={(e) => updateMetaEntry(index, "conversion_value", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <Button variant="outline" onClick={addMetaEntry} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              Add Another Meta Ad
            </Button>
          </TabsContent>
        </Tabs>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleImport} disabled={isImporting} className="gap-2">
            {isImporting ? (
              <>Importing...</>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Import & Analyze
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
