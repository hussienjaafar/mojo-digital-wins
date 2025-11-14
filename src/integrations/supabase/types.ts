export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      actblue_transactions: {
        Row: {
          amount: number
          created_at: string | null
          donor_email: string | null
          donor_name: string | null
          id: string
          is_recurring: boolean | null
          organization_id: string
          refcode: string | null
          source_campaign: string | null
          transaction_date: string
          transaction_id: string
          transaction_type: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          donor_email?: string | null
          donor_name?: string | null
          id?: string
          is_recurring?: boolean | null
          organization_id: string
          refcode?: string | null
          source_campaign?: string | null
          transaction_date: string
          transaction_id: string
          transaction_type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          donor_email?: string | null
          donor_name?: string | null
          id?: string
          is_recurring?: boolean | null
          organization_id?: string
          refcode?: string | null
          source_campaign?: string | null
          transaction_date?: string
          transaction_id?: string
          transaction_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action_type: string
          created_at: string
          id: string
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_affected: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_affected?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_affected?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          email_error: string | null
          email_sent_at: string | null
          email_sent_to: string | null
          email_status: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          resend_count: number | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          email_sent_to?: string | null
          email_status?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          resend_count?: number | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          email_error?: string | null
          email_sent_at?: string | null
          email_sent_to?: string | null
          email_status?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          resend_count?: number | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      admin_invite_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          custom_message: string | null
          footer_text: string | null
          header_text: string | null
          id: string
          is_default: boolean | null
          logo_url: string | null
          name: string
          primary_color: string | null
          subject: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          custom_message?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          subject?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          custom_message?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_default?: boolean | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          subject?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_invite_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_attribution: {
        Row: {
          created_at: string | null
          id: string
          meta_campaign_id: string | null
          organization_id: string
          refcode: string | null
          switchboard_campaign_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          meta_campaign_id?: string | null
          organization_id: string
          refcode?: string | null
          switchboard_campaign_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          meta_campaign_id?: string | null
          organization_id?: string
          refcode?: string | null
          switchboard_campaign_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_attribution_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_api_credentials: {
        Row: {
          created_at: string | null
          encrypted_credentials: Json
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          last_sync_status: string | null
          organization_id: string
          platform: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          encrypted_credentials: Json
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          organization_id: string
          platform: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          encrypted_credentials?: Json
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          organization_id?: string
          platform?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_api_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_organizations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          primary_contact_email: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          primary_contact_email?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          primary_contact_email?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      client_users: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          last_login_at: string | null
          organization_id: string
          role: string | null
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id: string
          last_login_at?: string | null
          organization_id: string
          role?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          last_login_at?: string | null
          organization_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          assigned_to: string | null
          campaign: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          organization_type: string | null
          priority: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          campaign?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          organization_type?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          campaign?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          organization_type?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_submissions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_aggregated_metrics: {
        Row: {
          calculated_at: string | null
          date: string
          id: string
          meta_clicks: number | null
          meta_impressions: number | null
          new_donors: number | null
          organization_id: string
          roi_percentage: number | null
          sms_conversions: number | null
          sms_sent: number | null
          total_ad_spend: number | null
          total_donations: number | null
          total_funds_raised: number | null
          total_sms_cost: number | null
        }
        Insert: {
          calculated_at?: string | null
          date: string
          id?: string
          meta_clicks?: number | null
          meta_impressions?: number | null
          new_donors?: number | null
          organization_id: string
          roi_percentage?: number | null
          sms_conversions?: number | null
          sms_sent?: number | null
          total_ad_spend?: number | null
          total_donations?: number | null
          total_funds_raised?: number | null
          total_sms_cost?: number | null
        }
        Update: {
          calculated_at?: string | null
          date?: string
          id?: string
          meta_clicks?: number | null
          meta_impressions?: number | null
          new_donors?: number | null
          organization_id?: string
          roi_percentage?: number | null
          sms_conversions?: number | null
          sms_sent?: number | null
          total_ad_spend?: number | null
          total_donations?: number | null
          total_funds_raised?: number | null
          total_sms_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_aggregated_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_report_logs: {
        Row: {
          error_message: string | null
          id: string
          organization_id: string
          recipients: string[]
          schedule_id: string
          sent_at: string
          status: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          organization_id: string
          recipients: string[]
          schedule_id: string
          sent_at?: string
          status: string
        }
        Update: {
          error_message?: string | null
          id?: string
          organization_id?: string
          recipients?: string[]
          schedule_id?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_report_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_report_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "email_report_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      email_report_schedules: {
        Row: {
          created_at: string
          custom_branding: Json | null
          day_of_month: number | null
          day_of_week: number | null
          frequency: string
          id: string
          is_active: boolean
          last_sent_at: string | null
          organization_id: string
          recipient_emails: string[]
          report_config: Json | null
          template_style: string | null
          time_of_day: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_branding?: Json | null
          day_of_month?: number | null
          day_of_week?: number | null
          frequency: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          organization_id: string
          recipient_emails: string[]
          report_config?: Json | null
          template_style?: string | null
          time_of_day?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_branding?: Json | null
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_sent_at?: string | null
          organization_id?: string
          recipient_emails?: string[]
          report_config?: Json | null
          template_style?: string | null
          time_of_day?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_report_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      login_history: {
        Row: {
          created_at: string
          email: string
          failure_reason: string | null
          id: string
          ip_address: string | null
          login_successful: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          login_successful?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: string | null
          login_successful?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meta_ad_metrics: {
        Row: {
          ad_creative_id: string | null
          ad_creative_name: string | null
          ad_id: string | null
          ad_set_id: string | null
          attribution_window: string | null
          audience_demographics: Json | null
          campaign_id: string
          clicks: number | null
          conversion_funnel_data: Json | null
          conversion_value: number | null
          conversions: number | null
          cost_per_result: number | null
          cpc: number | null
          cpm: number | null
          creative_type: Database["public"]["Enums"]["creative_type"] | null
          ctr: number | null
          date: string
          device_platform: string | null
          frequency: number | null
          id: string
          impressions: number | null
          organization_id: string
          placement: string | null
          reach: number | null
          relevance_score: number | null
          roas: number | null
          spend: number | null
          synced_at: string | null
        }
        Insert: {
          ad_creative_id?: string | null
          ad_creative_name?: string | null
          ad_id?: string | null
          ad_set_id?: string | null
          attribution_window?: string | null
          audience_demographics?: Json | null
          campaign_id: string
          clicks?: number | null
          conversion_funnel_data?: Json | null
          conversion_value?: number | null
          conversions?: number | null
          cost_per_result?: number | null
          cpc?: number | null
          cpm?: number | null
          creative_type?: Database["public"]["Enums"]["creative_type"] | null
          ctr?: number | null
          date: string
          device_platform?: string | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          organization_id: string
          placement?: string | null
          reach?: number | null
          relevance_score?: number | null
          roas?: number | null
          spend?: number | null
          synced_at?: string | null
        }
        Update: {
          ad_creative_id?: string | null
          ad_creative_name?: string | null
          ad_id?: string | null
          ad_set_id?: string | null
          attribution_window?: string | null
          audience_demographics?: Json | null
          campaign_id?: string
          clicks?: number | null
          conversion_funnel_data?: Json | null
          conversion_value?: number | null
          conversions?: number | null
          cost_per_result?: number | null
          cpc?: number | null
          cpm?: number | null
          creative_type?: Database["public"]["Enums"]["creative_type"] | null
          ctr?: number | null
          date?: string
          device_platform?: string | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          organization_id?: string
          placement?: string | null
          reach?: number | null
          relevance_score?: number | null
          roas?: number | null
          spend?: number | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_campaigns: {
        Row: {
          campaign_id: string
          campaign_name: string | null
          daily_budget: number | null
          end_date: string | null
          id: string
          lifetime_budget: number | null
          objective: string | null
          organization_id: string
          start_date: string | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          campaign_id: string
          campaign_name?: string | null
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          lifetime_budget?: number | null
          objective?: string | null
          organization_id: string
          start_date?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          campaign_id?: string
          campaign_name?: string | null
          daily_budget?: number | null
          end_date?: string | null
          id?: string
          lifetime_budget?: number | null
          objective?: string | null
          organization_id?: string
          start_date?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_sign_in_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          last_sign_in_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_sign_in_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      roi_analytics: {
        Row: {
          campaign_id: string
          campaign_roas: number | null
          created_at: string | null
          date: string
          first_touch_attribution: number | null
          id: string
          last_touch_attribution: number | null
          linear_attribution: number | null
          ltv_roi: number | null
          organization_id: string
          platform: string
          position_based_attribution: number | null
          time_decay_attribution: number | null
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          campaign_roas?: number | null
          created_at?: string | null
          date: string
          first_touch_attribution?: number | null
          id?: string
          last_touch_attribution?: number | null
          linear_attribution?: number | null
          ltv_roi?: number | null
          organization_id: string
          platform: string
          position_based_attribution?: number | null
          time_decay_attribution?: number | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          campaign_roas?: number | null
          created_at?: string | null
          date?: string
          first_touch_attribution?: number | null
          id?: string
          last_touch_attribution?: number | null
          linear_attribution?: number | null
          ltv_roi?: number | null
          organization_id?: string
          platform?: string
          position_based_attribution?: number | null
          time_decay_attribution?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roi_analytics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_campaign_metrics: {
        Row: {
          a_b_test_variant: string | null
          amount_raised: number | null
          audience_segment: string | null
          bounce_rate: number | null
          campaign_id: string
          campaign_name: string | null
          click_through_rate: number | null
          clicks: number | null
          conversion_rate: number | null
          conversions: number | null
          cost: number | null
          cost_per_conversion: number | null
          date: string
          delivery_rate: number | null
          delivery_time: string | null
          id: string
          message_content: string | null
          messages_delivered: number | null
          messages_failed: number | null
          messages_sent: number | null
          opt_out_rate: number | null
          opt_outs: number | null
          organization_id: string
          send_time: string | null
          synced_at: string | null
          time_to_conversion: number | null
        }
        Insert: {
          a_b_test_variant?: string | null
          amount_raised?: number | null
          audience_segment?: string | null
          bounce_rate?: number | null
          campaign_id: string
          campaign_name?: string | null
          click_through_rate?: number | null
          clicks?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          cost?: number | null
          cost_per_conversion?: number | null
          date: string
          delivery_rate?: number | null
          delivery_time?: string | null
          id?: string
          message_content?: string | null
          messages_delivered?: number | null
          messages_failed?: number | null
          messages_sent?: number | null
          opt_out_rate?: number | null
          opt_outs?: number | null
          organization_id: string
          send_time?: string | null
          synced_at?: string | null
          time_to_conversion?: number | null
        }
        Update: {
          a_b_test_variant?: string | null
          amount_raised?: number | null
          audience_segment?: string | null
          bounce_rate?: number | null
          campaign_id?: string
          campaign_name?: string | null
          click_through_rate?: number | null
          clicks?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          cost?: number | null
          cost_per_conversion?: number | null
          date?: string
          delivery_rate?: number | null
          delivery_time?: string | null
          id?: string
          message_content?: string | null
          messages_delivered?: number | null
          messages_failed?: number | null
          messages_sent?: number | null
          opt_out_rate?: number | null
          opt_outs?: number | null
          organization_id?: string
          send_time?: string | null
          synced_at?: string | null
          time_to_conversion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_campaign_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_notes: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          note: string
          submission_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          note: string
          submission_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          note?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_notes_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_notes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "contact_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      mv_daily_metrics_summary: {
        Row: {
          avg_roi_percentage: number | null
          date: string | null
          days_count: number | null
          last_calculated: string | null
          organization_id: string | null
          total_ad_spend: number | null
          total_donations: number | null
          total_funds_raised: number | null
          total_meta_clicks: number | null
          total_meta_impressions: number | null
          total_new_donors: number | null
          total_sms_conversions: number | null
          total_sms_cost: number | null
          total_sms_sent: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_aggregated_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_daily_metrics_summary: {
        Args: {
          _end_date: string
          _organization_id: string
          _start_date: string
        }
        Returns: {
          avg_roi_percentage: number
          date: string
          days_count: number
          total_ad_spend: number
          total_donations: number
          total_funds_raised: number
          total_meta_clicks: number
          total_meta_impressions: number
          total_new_donors: number
          total_sms_conversions: number
          total_sms_cost: number
          total_sms_sent: number
        }[]
      }
      get_submissions_with_details: {
        Args: never
        Returns: {
          assigned_to: string
          assigned_to_email: string
          campaign: string
          created_at: string
          email: string
          id: string
          message: string
          name: string
          notes_count: number
          organization_type: string
          priority: string
          resolved_at: string
          status: string
          updated_at: string
        }[]
      }
      get_user_organization_id: { Args: never; Returns: string }
      get_users_with_roles: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_sign_in_at: string
          roles: string[]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_admin: { Args: never; Returns: boolean }
      log_admin_action: {
        Args: {
          _action_type: string
          _new_value?: Json
          _old_value?: Json
          _record_id?: string
          _table_affected?: string
        }
        Returns: string
      }
      log_login_attempt: {
        Args: {
          _email: string
          _failure_reason?: string
          _successful: boolean
          _user_id: string
        }
        Returns: string
      }
      refresh_daily_metrics_summary: { Args: never; Returns: undefined }
      verify_admin_invite_code: {
        Args: { invite_code: string; user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      creative_type: "image" | "video" | "carousel" | "collection" | "slideshow"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      creative_type: ["image", "video", "carousel", "collection", "slideshow"],
    },
  },
} as const
