import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, BarChart3, Palette, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";

type ReportConfig = {
  metrics: string[];
  includeCharts: boolean;
  chartTypes: {
    fundsRaised: string;
    roi: string;
    channelSpend: string;
  };
  dateRangeType: string;
  customDays: number;
  includeComparison: boolean;
  comparisonPeriod: string;
};

type CustomBranding = {
  includeLogo: boolean;
  primaryColor: string;
  footerText: string | null;
};

type Schedule = {
  id: string;
  report_config: ReportConfig;
  template_style: string;
  custom_branding: CustomBranding;
};

const metricOptions = [
  { id: "funds_raised", label: "Total Funds Raised", description: "Revenue from all donations" },
  { id: "total_spend", label: "Total Spend", description: "Combined ad and SMS costs" },
  { id: "roi", label: "Return on Investment", description: "ROI percentage" },
  { id: "donations", label: "Donation Metrics", description: "Count and average donation" },
  { id: "meta_ads", label: "Meta Ads Performance", description: "Impressions, clicks, CTR" },
  { id: "sms", label: "SMS Campaign Metrics", description: "Messages sent and conversions" },
];

const chartTypeOptions = [
  { value: "line", label: "Line Chart" },
  { value: "bar", label: "Bar Chart" },
  { value: "pie", label: "Pie Chart" },
];

interface Props {
  scheduleId: string;
  onSave?: () => void;
}

const ReportCustomization = ({ scheduleId, onSave }: Props) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [config, setConfig] = useState<ReportConfig>({
    metrics: ["funds_raised", "total_spend", "roi", "donations", "meta_ads", "sms"],
    includeCharts: true,
    chartTypes: {
      fundsRaised: "line",
      roi: "line",
      channelSpend: "pie",
    },
    dateRangeType: "auto",
    customDays: 30,
    includeComparison: false,
    comparisonPeriod: "previous",
  });
  const [templateStyle, setTemplateStyle] = useState("professional");
  const [branding, setBranding] = useState<CustomBranding>({
    includeLogo: true,
    primaryColor: "#667eea",
    footerText: null,
  });

  useEffect(() => {
    loadSchedule();
  }, [scheduleId]);

  const loadSchedule = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("email_report_schedules")
        .select("*")
        .eq("id", scheduleId)
        .single();

      if (error) throw error;

      setSchedule(data);
      setConfig(data.report_config || config);
      setTemplateStyle(data.template_style || "professional");
      setBranding(data.custom_branding || branding);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load report configuration",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("email_report_schedules")
        .update({
          report_config: config,
          template_style: templateStyle,
          custom_branding: branding,
        })
        .eq("id", scheduleId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Report customization saved successfully",
      });

      onSave?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save customization",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMetric = (metricId: string) => {
    setConfig((prev) => ({
      ...prev,
      metrics: prev.metrics.includes(metricId)
        ? prev.metrics.filter((m) => m !== metricId)
        : [...prev.metrics, metricId],
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading customization...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Report Customization
            </CardTitle>
            <CardDescription>Customize what appears in your email reports</CardDescription>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="metrics" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="metrics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="charts">
              <BarChart3 className="h-4 w-4 mr-2" />
              Charts
            </TabsTrigger>
            <TabsTrigger value="branding">
              <Palette className="h-4 w-4 mr-2" />
              Branding
            </TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Select Metrics to Include</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose which metrics will appear in your email reports
                </p>
              </div>

              <div className="space-y-4">
                {metricOptions.map((metric) => (
                  <div key={metric.id} className="flex items-start space-x-3 p-4 border rounded-lg">
                    <Checkbox
                      id={metric.id}
                      checked={config.metrics.includes(metric.id)}
                      onCheckedChange={() => toggleMetric(metric.id)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={metric.id} className="text-base font-medium cursor-pointer">
                        {metric.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">{metric.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Date Range Settings</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Configure the time period for report data
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Date Range Type</Label>
                    <Select
                      value={config.dateRangeType}
                      onValueChange={(value) => setConfig({ ...config, dateRangeType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (based on frequency)</SelectItem>
                        <SelectItem value="custom">Custom Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {config.dateRangeType === "custom" && (
                    <div className="space-y-2">
                      <Label>Number of Days</Label>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={config.customDays}
                        onChange={(e) => setConfig({ ...config, customDays: parseInt(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Reports will include data from the last {config.customDays} days
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <Checkbox
                    id="includeComparison"
                    checked={config.includeComparison}
                    onCheckedChange={(checked) =>
                      setConfig({ ...config, includeComparison: checked as boolean })
                    }
                  />
                  <div className="flex-1">
                    <Label htmlFor="includeComparison" className="text-base font-medium cursor-pointer">
                      Include Period Comparison
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Compare current period with previous period
                    </p>
                  </div>
                </div>

                {config.includeComparison && (
                  <div className="space-y-2 ml-8">
                    <Label>Compare To</Label>
                    <Select
                      value={config.comparisonPeriod}
                      onValueChange={(value) => setConfig({ ...config, comparisonPeriod: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="previous">Previous Period</SelectItem>
                        <SelectItem value="year_ago">Same Period Last Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="charts" className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Chart Configuration</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Configure how data is visualized in your reports
                </p>
              </div>

              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <Checkbox
                  id="includeCharts"
                  checked={config.includeCharts}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, includeCharts: checked as boolean })
                  }
                />
                <div className="flex-1">
                  <Label htmlFor="includeCharts" className="text-base font-medium cursor-pointer">
                    Include Charts in Reports
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Visual charts make data easier to understand
                  </p>
                </div>
              </div>

              {config.includeCharts && (
                <div className="space-y-6 ml-8">
                  <div className="space-y-2">
                    <Label>Funds Raised Chart Type</Label>
                    <Select
                      value={config.chartTypes.fundsRaised}
                      onValueChange={(value) =>
                        setConfig({
                          ...config,
                          chartTypes: { ...config.chartTypes, fundsRaised: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {chartTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>ROI Trend Chart Type</Label>
                    <Select
                      value={config.chartTypes.roi}
                      onValueChange={(value) =>
                        setConfig({
                          ...config,
                          chartTypes: { ...config.chartTypes, roi: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {chartTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Channel Spend Chart Type</Label>
                    <Select
                      value={config.chartTypes.channelSpend}
                      onValueChange={(value) =>
                        setConfig({
                          ...config,
                          chartTypes: { ...config.chartTypes, channelSpend: value },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {chartTypeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="branding" className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Report Template Style</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose the overall look and feel of your reports
                </p>
              </div>

              <div className="space-y-2">
                <Label>Template Style</Label>
                <Select value={templateStyle} onValueChange={setTemplateStyle}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional (Default)</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="detailed">Detailed</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {templateStyle === "professional" && "Balanced design with charts and key metrics"}
                  {templateStyle === "minimal" && "Clean, numbers-focused layout"}
                  {templateStyle === "detailed" && "Comprehensive view with all available data"}
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Custom Branding</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Personalize the appearance of your reports
                  </p>
                </div>

                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <Checkbox
                    id="includeLogo"
                    checked={branding.includeLogo}
                    onCheckedChange={(checked) =>
                      setBranding({ ...branding, includeLogo: checked as boolean })
                    }
                  />
                  <div className="flex-1">
                    <Label htmlFor="includeLogo" className="text-base font-medium cursor-pointer">
                      Include Organization Logo
                    </Label>
                    <p className="text-sm text-muted-foreground">Show your logo in the email header</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      placeholder="#667eea"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for headers and accent elements
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Custom Footer Text (Optional)</Label>
                  <Input
                    value={branding.footerText || ""}
                    onChange={(e) => setBranding({ ...branding, footerText: e.target.value || null })}
                    placeholder="e.g., Questions? Contact us at support@example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use default footer text
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ReportCustomization;
