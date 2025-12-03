import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Building2, Mail, Save, Loader2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_contact_email: string | null;
  updated_at: string | null;
}

export function OrganizationDetails() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    primary_contact_email: "",
    logo_url: "",
  });

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientUser } = await supabase
        .from("client_users")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!clientUser) return;

      const { data, error } = await supabase
        .from("client_organizations")
        .select("*")
        .eq("id", clientUser.organization_id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return;

      setOrganization(data);
      setFormData({
        name: data.name || "",
        primary_contact_email: data.primary_contact_email || "",
        logo_url: data.logo_url || "",
      });
    } catch (error) {
      console.error("Error fetching organization:", error);
      toast.error("Failed to load organization details");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("client_organizations")
        .update({
          name: formData.name,
          primary_contact_email: formData.primary_contact_email,
          logo_url: formData.logo_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organization.id);

      if (error) throw error;

      toast.success("Organization details saved");
      fetchOrganization();
    } catch (error) {
      console.error("Error saving organization:", error);
      toast.error("Failed to save organization details");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Organization not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        <div className="space-y-2">
          <Label htmlFor="org-name" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Organization Name
          </Label>
          <Input
            id="org-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Your organization name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Primary Contact Email
          </Label>
          <Input
            id="org-email"
            type="email"
            value={formData.primary_contact_email}
            onChange={(e) => setFormData({ ...formData, primary_contact_email: e.target.value })}
            placeholder="contact@organization.com"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-logo">Logo URL</Label>
          <Input
            id="org-logo"
            value={formData.logo_url}
            onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
            placeholder="https://example.com/logo.png"
          />
          {formData.logo_url && (
            <div className="mt-2">
              <img
                src={formData.logo_url}
                alt="Organization logo preview"
                className="h-16 w-auto object-contain rounded border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Organization Slug</span>
            <span className="font-mono">{organization.slug}</span>
          </div>
          {organization.updated_at && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Updated</span>
              <span>{new Date(organization.updated_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </>
        )}
      </Button>
    </div>
  );
}
