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
          ab_test_name: string | null
          ab_test_variation: string | null
          addr1: string | null
          amount: number
          city: string | null
          committee_name: string | null
          contribution_form: string | null
          country: string | null
          created_at: string | null
          custom_fields: Json | null
          donor_email: string | null
          donor_name: string | null
          employer: string | null
          entity_id: string | null
          fec_id: string | null
          first_name: string | null
          id: string
          is_express: boolean | null
          is_mobile: boolean | null
          is_recurring: boolean | null
          last_name: string | null
          lineitem_id: number | null
          occupation: string | null
          order_number: string | null
          organization_id: string
          phone: string | null
          recurring_duration: number | null
          recurring_period: string | null
          refcode: string | null
          refcode_custom: string | null
          refcode2: string | null
          source_campaign: string | null
          state: string | null
          text_message_option: string | null
          transaction_date: string
          transaction_id: string
          transaction_type: string | null
          zip: string | null
        }
        Insert: {
          ab_test_name?: string | null
          ab_test_variation?: string | null
          addr1?: string | null
          amount: number
          city?: string | null
          committee_name?: string | null
          contribution_form?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          donor_email?: string | null
          donor_name?: string | null
          employer?: string | null
          entity_id?: string | null
          fec_id?: string | null
          first_name?: string | null
          id?: string
          is_express?: boolean | null
          is_mobile?: boolean | null
          is_recurring?: boolean | null
          last_name?: string | null
          lineitem_id?: number | null
          occupation?: string | null
          order_number?: string | null
          organization_id: string
          phone?: string | null
          recurring_duration?: number | null
          recurring_period?: string | null
          refcode?: string | null
          refcode_custom?: string | null
          refcode2?: string | null
          source_campaign?: string | null
          state?: string | null
          text_message_option?: string | null
          transaction_date: string
          transaction_id: string
          transaction_type?: string | null
          zip?: string | null
        }
        Update: {
          ab_test_name?: string | null
          ab_test_variation?: string | null
          addr1?: string | null
          amount?: number
          city?: string | null
          committee_name?: string | null
          contribution_form?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          donor_email?: string | null
          donor_name?: string | null
          employer?: string | null
          entity_id?: string | null
          fec_id?: string | null
          first_name?: string | null
          id?: string
          is_express?: boolean | null
          is_mobile?: boolean | null
          is_recurring?: boolean | null
          last_name?: string | null
          lineitem_id?: number | null
          occupation?: string | null
          order_number?: string | null
          organization_id?: string
          phone?: string | null
          recurring_duration?: number | null
          recurring_period?: string | null
          refcode?: string | null
          refcode_custom?: string | null
          refcode2?: string | null
          source_campaign?: string | null
          state?: string | null
          text_message_option?: string | null
          transaction_date?: string
          transaction_id?: string
          transaction_type?: string | null
          zip?: string | null
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
      admin_activity_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          details: string | null
          entity_name: string | null
          id: string
          is_resolved: boolean | null
          organization_id: string | null
          relevance_score: number | null
          resolved_at: string | null
          resolved_by: string | null
          usage_count: number | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          details?: string | null
          entity_name?: string | null
          id?: string
          is_resolved?: boolean | null
          organization_id?: string | null
          relevance_score?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          usage_count?: number | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          details?: string | null
          entity_name?: string | null
          id?: string
          is_resolved?: boolean | null
          organization_id?: string | null
          relevance_score?: number | null
          resolved_at?: string | null
          resolved_by?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_activity_alerts_organization_id_fkey"
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
      ai_analysis_cache: {
        Row: {
          content_hash: string
          created_at: string | null
          hit_count: number | null
          id: string
          last_used_at: string | null
          model: string
          prompt_hash: string
          response: Json
        }
        Insert: {
          content_hash: string
          created_at?: string | null
          hit_count?: number | null
          id?: string
          last_used_at?: string | null
          model: string
          prompt_hash: string
          response: Json
        }
        Update: {
          content_hash?: string
          created_at?: string | null
          hit_count?: number | null
          id?: string
          last_used_at?: string | null
          model?: string
          prompt_hash?: string
          response?: Json
        }
        Relationships: []
      }
      alert_queue: {
        Row: {
          alert_type: string
          created_at: string
          data: Json | null
          error_message: string | null
          id: string
          message: string
          sent_at: string | null
          severity: string
          status: string | null
          title: string
          triggered_by_rule: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string
          data?: Json | null
          error_message?: string | null
          id?: string
          message: string
          sent_at?: string | null
          severity: string
          status?: string | null
          title: string
          triggered_by_rule?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string
          data?: Json | null
          error_message?: string | null
          id?: string
          message?: string
          sent_at?: string | null
          severity?: string
          status?: string | null
          title?: string
          triggered_by_rule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_queue_triggered_by_rule_fkey"
            columns: ["triggered_by_rule"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          conditions: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          notification_channels: string[] | null
          recipient_emails: string[] | null
          rule_name: string
          rule_type: string
          severity: string
          updated_at: string
        }
        Insert: {
          conditions: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          notification_channels?: string[] | null
          recipient_emails?: string[] | null
          rule_name: string
          rule_type: string
          severity?: string
          updated_at?: string
        }
        Update: {
          conditions?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          notification_channels?: string[] | null
          recipient_emails?: string[] | null
          rule_name?: string
          rule_type?: string
          severity?: string
          updated_at?: string
        }
        Relationships: []
      }
      anomaly_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          baseline_value: number | null
          current_value: number
          detected_at: string | null
          deviation_percentage: number | null
          entity_type: string | null
          id: string
          is_acknowledged: boolean | null
          metadata: Json | null
          resolved_at: string | null
          severity: string | null
          topic: string
          z_score: number | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          baseline_value?: number | null
          current_value: number
          detected_at?: string | null
          deviation_percentage?: number | null
          entity_type?: string | null
          id?: string
          is_acknowledged?: boolean | null
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string | null
          topic: string
          z_score?: number | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          baseline_value?: number | null
          current_value?: number
          detected_at?: string | null
          deviation_percentage?: number | null
          entity_type?: string | null
          id?: string
          is_acknowledged?: boolean | null
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string | null
          topic?: string
          z_score?: number | null
        }
        Relationships: []
      }
      article_bookmarks: {
        Row: {
          article_id: string
          created_at: string | null
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_bookmarks_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_clusters: {
        Row: {
          cluster_summary: string | null
          cluster_title: string
          created_at: string | null
          id: string
          primary_article_id: string
          related_article_ids: string[]
          similarity_threshold: number | null
          updated_at: string | null
        }
        Insert: {
          cluster_summary?: string | null
          cluster_title: string
          created_at?: string | null
          id?: string
          primary_article_id: string
          related_article_ids?: string[]
          similarity_threshold?: number | null
          updated_at?: string | null
        }
        Update: {
          cluster_summary?: string | null
          cluster_title?: string
          created_at?: string | null
          id?: string
          primary_article_id?: string
          related_article_ids?: string[]
          similarity_threshold?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_clusters_primary_article_id_fkey"
            columns: ["primary_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          affected_groups: string[] | null
          affected_organizations: string[] | null
          ai_confidence_score: number | null
          ai_summary: string | null
          category: string | null
          content: string | null
          created_at: string | null
          description: string | null
          duplicate_of: string | null
          extracted_hashtags: string[] | null
          extracted_topics: Json | null
          geographic_scope: string | null
          hash_signature: string | null
          id: string
          image_url: string | null
          is_duplicate: boolean | null
          political_leaning: string | null
          processing_status: string | null
          published_date: string
          relevance_category: string | null
          sentiment_confidence: number | null
          sentiment_label: string | null
          sentiment_score: number | null
          source_id: string | null
          source_name: string
          source_url: string
          tags: string[] | null
          threat_level: string | null
          title: string
          topics_extracted: boolean | null
          topics_extracted_at: string | null
          updated_at: string | null
          validation_errors: string[] | null
          validation_passed: boolean | null
        }
        Insert: {
          affected_groups?: string[] | null
          affected_organizations?: string[] | null
          ai_confidence_score?: number | null
          ai_summary?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          description?: string | null
          duplicate_of?: string | null
          extracted_hashtags?: string[] | null
          extracted_topics?: Json | null
          geographic_scope?: string | null
          hash_signature?: string | null
          id?: string
          image_url?: string | null
          is_duplicate?: boolean | null
          political_leaning?: string | null
          processing_status?: string | null
          published_date: string
          relevance_category?: string | null
          sentiment_confidence?: number | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          source_id?: string | null
          source_name: string
          source_url: string
          tags?: string[] | null
          threat_level?: string | null
          title: string
          topics_extracted?: boolean | null
          topics_extracted_at?: string | null
          updated_at?: string | null
          validation_errors?: string[] | null
          validation_passed?: boolean | null
        }
        Update: {
          affected_groups?: string[] | null
          affected_organizations?: string[] | null
          ai_confidence_score?: number | null
          ai_summary?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          description?: string | null
          duplicate_of?: string | null
          extracted_hashtags?: string[] | null
          extracted_topics?: Json | null
          geographic_scope?: string | null
          hash_signature?: string | null
          id?: string
          image_url?: string | null
          is_duplicate?: boolean | null
          political_leaning?: string | null
          processing_status?: string | null
          published_date?: string
          relevance_category?: string | null
          sentiment_confidence?: number | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          source_id?: string | null
          source_name?: string
          source_url?: string
          tags?: string[] | null
          threat_level?: string | null
          title?: string
          topics_extracted?: boolean | null
          topics_extracted_at?: string | null
          updated_at?: string | null
          validation_errors?: string[] | null
          validation_passed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "rss_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      articles_archive: {
        Row: {
          affected_groups: string[] | null
          ai_summary: string | null
          archived_at: string | null
          id: string
          published_date: string
          relevance_category: string | null
          sentiment_score: number | null
          source_name: string
          source_url: string
          threat_level: string | null
          title: string
        }
        Insert: {
          affected_groups?: string[] | null
          ai_summary?: string | null
          archived_at?: string | null
          id: string
          published_date: string
          relevance_category?: string | null
          sentiment_score?: number | null
          source_name: string
          source_url: string
          threat_level?: string | null
          title: string
        }
        Update: {
          affected_groups?: string[] | null
          ai_summary?: string | null
          archived_at?: string | null
          id?: string
          published_date?: string
          relevance_category?: string | null
          sentiment_score?: number | null
          source_name?: string
          source_url?: string
          threat_level?: string | null
          title?: string
        }
        Relationships: []
      }
      attribution_health_logs: {
        Row: {
          alerts: Json
          checked_at: string
          created_at: string
          critical_alerts: number
          id: string
          total_alerts: number
        }
        Insert: {
          alerts?: Json
          checked_at?: string
          created_at?: string
          critical_alerts?: number
          id?: string
          total_alerts?: number
        }
        Update: {
          alerts?: Json
          checked_at?: string
          created_at?: string
          critical_alerts?: number
          id?: string
          total_alerts?: number
        }
        Relationships: []
      }
      attribution_touchpoints: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          donor_email: string | null
          id: string
          metadata: Json | null
          occurred_at: string
          organization_id: string | null
          refcode: string | null
          touchpoint_type: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          donor_email?: string | null
          id?: string
          metadata?: Json | null
          occurred_at: string
          organization_id?: string | null
          refcode?: string | null
          touchpoint_type: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          donor_email?: string | null
          id?: string
          metadata?: Json | null
          occurred_at?: string
          organization_id?: string | null
          refcode?: string | null
          touchpoint_type?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attribution_touchpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      backfill_status: {
        Row: {
          batches_run: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          estimated_hours_remaining: number | null
          failed_items: number | null
          id: string
          last_batch_at: string | null
          posts_per_second: number | null
          processed_items: number | null
          started_at: string | null
          status: string | null
          task_name: string
          total_items: number | null
          updated_at: string | null
        }
        Insert: {
          batches_run?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          estimated_hours_remaining?: number | null
          failed_items?: number | null
          id?: string
          last_batch_at?: string | null
          posts_per_second?: number | null
          processed_items?: number | null
          started_at?: string | null
          status?: string | null
          task_name: string
          total_items?: number | null
          updated_at?: string | null
        }
        Update: {
          batches_run?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          estimated_hours_remaining?: number | null
          failed_items?: number | null
          id?: string
          last_batch_at?: string | null
          posts_per_second?: number | null
          processed_items?: number | null
          started_at?: string | null
          status?: string | null
          task_name?: string
          total_items?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bill_actions: {
        Row: {
          action_code: string | null
          action_date: string
          action_text: string
          bill_id: string | null
          chamber: string | null
          created_at: string | null
          id: string
        }
        Insert: {
          action_code?: string | null
          action_date: string
          action_text: string
          bill_id?: string | null
          chamber?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          action_code?: string | null
          action_date?: string
          action_text?: string
          bill_id?: string | null
          chamber?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_actions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_alerts: {
        Row: {
          alert_type: string
          bill_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_notified_at: string | null
          user_id: string | null
        }
        Insert: {
          alert_type?: string
          bill_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_notified_at?: string | null
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          bill_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_notified_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_alerts_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_number: string
          bill_text_url: string | null
          bill_type: string
          committee_assignments: string[] | null
          congress: number
          cosponsor_count: number | null
          cosponsor_party_breakdown: Json | null
          created_at: string | null
          current_status: string | null
          full_text: string | null
          id: string
          introduced_date: string | null
          latest_action_date: string | null
          latest_action_text: string | null
          origin_chamber: string | null
          related_bills: string[] | null
          relevance_score: number | null
          short_title: string | null
          sponsor_id: string | null
          sponsor_name: string | null
          sponsor_party: string | null
          sponsor_state: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          bill_number: string
          bill_text_url?: string | null
          bill_type: string
          committee_assignments?: string[] | null
          congress: number
          cosponsor_count?: number | null
          cosponsor_party_breakdown?: Json | null
          created_at?: string | null
          current_status?: string | null
          full_text?: string | null
          id?: string
          introduced_date?: string | null
          latest_action_date?: string | null
          latest_action_text?: string | null
          origin_chamber?: string | null
          related_bills?: string[] | null
          relevance_score?: number | null
          short_title?: string | null
          sponsor_id?: string | null
          sponsor_name?: string | null
          sponsor_party?: string | null
          sponsor_state?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          bill_number?: string
          bill_text_url?: string | null
          bill_type?: string
          committee_assignments?: string[] | null
          congress?: number
          cosponsor_count?: number | null
          cosponsor_party_breakdown?: Json | null
          created_at?: string | null
          current_status?: string | null
          full_text?: string | null
          id?: string
          introduced_date?: string | null
          latest_action_date?: string | null
          latest_action_text?: string | null
          origin_chamber?: string | null
          related_bills?: string[] | null
          relevance_score?: number | null
          short_title?: string | null
          sponsor_id?: string | null
          sponsor_name?: string | null
          sponsor_party?: string | null
          sponsor_state?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      bluesky_article_correlations: {
        Row: {
          article_id: string | null
          article_published: string | null
          correlation_strength: number | null
          detected_at: string | null
          id: string
          is_predictive: boolean | null
          peak_social_time: string | null
          social_mentions: number | null
          social_sentiment: number | null
          time_lag_minutes: number | null
          topic: string
        }
        Insert: {
          article_id?: string | null
          article_published?: string | null
          correlation_strength?: number | null
          detected_at?: string | null
          id?: string
          is_predictive?: boolean | null
          peak_social_time?: string | null
          social_mentions?: number | null
          social_sentiment?: number | null
          time_lag_minutes?: number | null
          topic: string
        }
        Update: {
          article_id?: string | null
          article_published?: string | null
          correlation_strength?: number | null
          detected_at?: string | null
          id?: string
          is_predictive?: boolean | null
          peak_social_time?: string | null
          social_mentions?: number | null
          social_sentiment?: number | null
          time_lag_minutes?: number | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "bluesky_article_correlations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      bluesky_keywords: {
        Row: {
          alert_sent: boolean | null
          alert_threshold: number | null
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          keyword: string
          last_mention_at: string | null
          priority: string | null
          total_mentions: number | null
          updated_at: string | null
        }
        Insert: {
          alert_sent?: boolean | null
          alert_threshold?: number | null
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keyword: string
          last_mention_at?: string | null
          priority?: string | null
          total_mentions?: number | null
          updated_at?: string | null
        }
        Update: {
          alert_sent?: boolean | null
          alert_threshold?: number | null
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keyword?: string
          last_mention_at?: string | null
          priority?: string | null
          total_mentions?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bluesky_posts: {
        Row: {
          affected_groups: string[] | null
          ai_confidence_score: number | null
          ai_processed: boolean | null
          ai_processed_at: string | null
          ai_relevance_score: number | null
          ai_sentiment: number | null
          ai_sentiment_label: string | null
          ai_topics: string[] | null
          author_did: string
          author_handle: string | null
          created_at: string
          embed_type: string | null
          hashtags: string[] | null
          id: string
          indexed_at: string | null
          langs: string[] | null
          mentions: string[] | null
          post_cid: string | null
          post_uri: string
          quote_of: string | null
          relevance_category: string | null
          reply_to: string | null
          text: string | null
          urls: string[] | null
          validation_errors: string[] | null
          validation_passed: boolean | null
        }
        Insert: {
          affected_groups?: string[] | null
          ai_confidence_score?: number | null
          ai_processed?: boolean | null
          ai_processed_at?: string | null
          ai_relevance_score?: number | null
          ai_sentiment?: number | null
          ai_sentiment_label?: string | null
          ai_topics?: string[] | null
          author_did: string
          author_handle?: string | null
          created_at: string
          embed_type?: string | null
          hashtags?: string[] | null
          id?: string
          indexed_at?: string | null
          langs?: string[] | null
          mentions?: string[] | null
          post_cid?: string | null
          post_uri: string
          quote_of?: string | null
          relevance_category?: string | null
          reply_to?: string | null
          text?: string | null
          urls?: string[] | null
          validation_errors?: string[] | null
          validation_passed?: boolean | null
        }
        Update: {
          affected_groups?: string[] | null
          ai_confidence_score?: number | null
          ai_processed?: boolean | null
          ai_processed_at?: string | null
          ai_relevance_score?: number | null
          ai_sentiment?: number | null
          ai_sentiment_label?: string | null
          ai_topics?: string[] | null
          author_did?: string
          author_handle?: string | null
          created_at?: string
          embed_type?: string | null
          hashtags?: string[] | null
          id?: string
          indexed_at?: string | null
          langs?: string[] | null
          mentions?: string[] | null
          post_cid?: string | null
          post_uri?: string
          quote_of?: string | null
          relevance_category?: string | null
          reply_to?: string | null
          text?: string | null
          urls?: string[] | null
          validation_errors?: string[] | null
          validation_passed?: boolean | null
        }
        Relationships: []
      }
      bluesky_posts_archive: {
        Row: {
          affected_groups: string[] | null
          ai_sentiment: number | null
          ai_sentiment_label: string | null
          ai_topics: string[] | null
          archived_at: string | null
          author_did: string
          created_at: string
          id: string
          post_uri: string
          text: string | null
        }
        Insert: {
          affected_groups?: string[] | null
          ai_sentiment?: number | null
          ai_sentiment_label?: string | null
          ai_topics?: string[] | null
          archived_at?: string | null
          author_did: string
          created_at: string
          id: string
          post_uri: string
          text?: string | null
        }
        Update: {
          affected_groups?: string[] | null
          ai_sentiment?: number | null
          ai_sentiment_label?: string | null
          ai_topics?: string[] | null
          archived_at?: string | null
          author_did?: string
          created_at?: string
          id?: string
          post_uri?: string
          text?: string | null
        }
        Relationships: []
      }
      bluesky_stream_cursor: {
        Row: {
          id: number
          last_cursor: number
          last_error: string | null
          last_updated_at: string | null
          posts_collected: number | null
        }
        Insert: {
          id?: number
          last_cursor: number
          last_error?: string | null
          last_updated_at?: string | null
          posts_collected?: number | null
        }
        Update: {
          id?: number
          last_cursor?: number
          last_error?: string | null
          last_updated_at?: string | null
          posts_collected?: number | null
        }
        Relationships: []
      }
      bluesky_topic_clusters: {
        Row: {
          author_count: number | null
          central_topic: string | null
          centrality: number | null
          cluster_name: string
          cluster_sentiment: number | null
          cluster_velocity: number | null
          density: number | null
          detected_at: string | null
          engagement_score: number | null
          id: string
          is_breaking: boolean | null
          last_updated: string | null
          post_count: number | null
          related_news_cluster_id: string | null
          topics: string[]
        }
        Insert: {
          author_count?: number | null
          central_topic?: string | null
          centrality?: number | null
          cluster_name: string
          cluster_sentiment?: number | null
          cluster_velocity?: number | null
          density?: number | null
          detected_at?: string | null
          engagement_score?: number | null
          id?: string
          is_breaking?: boolean | null
          last_updated?: string | null
          post_count?: number | null
          related_news_cluster_id?: string | null
          topics: string[]
        }
        Update: {
          author_count?: number | null
          central_topic?: string | null
          centrality?: number | null
          cluster_name?: string
          cluster_sentiment?: number | null
          cluster_velocity?: number | null
          density?: number | null
          detected_at?: string | null
          engagement_score?: number | null
          id?: string
          is_breaking?: boolean | null
          last_updated?: string | null
          post_count?: number | null
          related_news_cluster_id?: string | null
          topics?: string[]
        }
        Relationships: []
      }
      bluesky_trends: {
        Row: {
          calculated_at: string | null
          correlation_score: number | null
          first_seen_at: string | null
          id: string
          is_trending: boolean | null
          keyword_variations: string[] | null
          last_seen_at: string | null
          mentions_last_24_hours: number | null
          mentions_last_6_hours: number | null
          mentions_last_hour: number | null
          mentions_last_week: number | null
          peak_at: string | null
          peak_velocity: number | null
          related_articles: string[] | null
          related_bills: string[] | null
          related_executive_orders: string[] | null
          sentiment_avg: number | null
          sentiment_negative: number | null
          sentiment_neutral: number | null
          sentiment_positive: number | null
          topic: string
          trending_since: string | null
          updated_at: string | null
          velocity: number | null
        }
        Insert: {
          calculated_at?: string | null
          correlation_score?: number | null
          first_seen_at?: string | null
          id?: string
          is_trending?: boolean | null
          keyword_variations?: string[] | null
          last_seen_at?: string | null
          mentions_last_24_hours?: number | null
          mentions_last_6_hours?: number | null
          mentions_last_hour?: number | null
          mentions_last_week?: number | null
          peak_at?: string | null
          peak_velocity?: number | null
          related_articles?: string[] | null
          related_bills?: string[] | null
          related_executive_orders?: string[] | null
          sentiment_avg?: number | null
          sentiment_negative?: number | null
          sentiment_neutral?: number | null
          sentiment_positive?: number | null
          topic: string
          trending_since?: string | null
          updated_at?: string | null
          velocity?: number | null
        }
        Update: {
          calculated_at?: string | null
          correlation_score?: number | null
          first_seen_at?: string | null
          id?: string
          is_trending?: boolean | null
          keyword_variations?: string[] | null
          last_seen_at?: string | null
          mentions_last_24_hours?: number | null
          mentions_last_6_hours?: number | null
          mentions_last_hour?: number | null
          mentions_last_week?: number | null
          peak_at?: string | null
          peak_velocity?: number | null
          related_articles?: string[] | null
          related_bills?: string[] | null
          related_executive_orders?: string[] | null
          sentiment_avg?: number | null
          sentiment_negative?: number | null
          sentiment_neutral?: number | null
          sentiment_positive?: number | null
          topic?: string
          trending_since?: string | null
          updated_at?: string | null
          velocity?: number | null
        }
        Relationships: []
      }
      bluesky_velocity_metrics: {
        Row: {
          calculation_time_ms: number | null
          created_at: string | null
          error_count: number | null
          id: string
          topics_processed: number | null
          trending_detected: number | null
        }
        Insert: {
          calculation_time_ms?: number | null
          created_at?: string | null
          error_count?: number | null
          id?: string
          topics_processed?: number | null
          trending_detected?: number | null
        }
        Update: {
          calculation_time_ms?: number | null
          created_at?: string | null
          error_count?: number | null
          id?: string
          topics_processed?: number | null
          trending_detected?: number | null
        }
        Relationships: []
      }
      breaking_news_clusters: {
        Row: {
          article_ids: string[] | null
          cluster_title: string
          created_at: string
          first_detected_at: string
          geographic_scope: string[] | null
          id: string
          is_resolved: boolean | null
          key_entities: string[] | null
          last_updated_at: string
          resolved_at: string | null
          severity: string
          summary: string | null
          threat_level: number | null
        }
        Insert: {
          article_ids?: string[] | null
          cluster_title: string
          created_at?: string
          first_detected_at?: string
          geographic_scope?: string[] | null
          id?: string
          is_resolved?: boolean | null
          key_entities?: string[] | null
          last_updated_at?: string
          resolved_at?: string | null
          severity?: string
          summary?: string | null
          threat_level?: number | null
        }
        Update: {
          article_ids?: string[] | null
          cluster_title?: string
          created_at?: string
          first_detected_at?: string
          geographic_scope?: string[] | null
          id?: string
          is_resolved?: boolean | null
          key_entities?: string[] | null
          last_updated_at?: string
          resolved_at?: string | null
          severity?: string
          summary?: string | null
          threat_level?: number | null
        }
        Relationships: []
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
      client_entity_alerts: {
        Row: {
          actionable_score: number | null
          alert_type: string
          created_at: string | null
          current_mentions: number | null
          entity_name: string
          id: string
          is_actionable: boolean | null
          is_read: boolean | null
          organization_id: string | null
          sample_sources: Json | null
          severity: string | null
          suggested_action: string | null
          triggered_at: string | null
          velocity: number | null
          watchlist_id: string | null
        }
        Insert: {
          actionable_score?: number | null
          alert_type: string
          created_at?: string | null
          current_mentions?: number | null
          entity_name: string
          id?: string
          is_actionable?: boolean | null
          is_read?: boolean | null
          organization_id?: string | null
          sample_sources?: Json | null
          severity?: string | null
          suggested_action?: string | null
          triggered_at?: string | null
          velocity?: number | null
          watchlist_id?: string | null
        }
        Update: {
          actionable_score?: number | null
          alert_type?: string
          created_at?: string | null
          current_mentions?: number | null
          entity_name?: string
          id?: string
          is_actionable?: boolean | null
          is_read?: boolean | null
          organization_id?: string | null
          sample_sources?: Json | null
          severity?: string | null
          suggested_action?: string | null
          triggered_at?: string | null
          velocity?: number | null
          watchlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_entity_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_entity_alerts_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "entity_watchlist"
            referencedColumns: ["id"]
          },
        ]
      }
      client_onboarding_status: {
        Row: {
          completed_at: string | null
          id: string
          metadata: Json | null
          organization_id: string
          step_completed: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          step_completed: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          step_completed?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_onboarding_status_organization_id_fkey"
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
      creative_performance_learnings: {
        Row: {
          avg_amount_raised: number | null
          avg_click_rate: number | null
          avg_conversion_rate: number | null
          avg_roas: number | null
          calculated_at: string | null
          call_to_action: string | null
          channel: string
          confidence_level: number | null
          created_at: string | null
          effectiveness_score: number | null
          emotional_appeal: string | null
          id: string
          optimal_day: number | null
          optimal_hour: number | null
          organization_id: string | null
          period_end: string | null
          period_start: string | null
          sample_size: number | null
          tone: string | null
          topic: string | null
          updated_at: string | null
          urgency_level: string | null
        }
        Insert: {
          avg_amount_raised?: number | null
          avg_click_rate?: number | null
          avg_conversion_rate?: number | null
          avg_roas?: number | null
          calculated_at?: string | null
          call_to_action?: string | null
          channel: string
          confidence_level?: number | null
          created_at?: string | null
          effectiveness_score?: number | null
          emotional_appeal?: string | null
          id?: string
          optimal_day?: number | null
          optimal_hour?: number | null
          organization_id?: string | null
          period_end?: string | null
          period_start?: string | null
          sample_size?: number | null
          tone?: string | null
          topic?: string | null
          updated_at?: string | null
          urgency_level?: string | null
        }
        Update: {
          avg_amount_raised?: number | null
          avg_click_rate?: number | null
          avg_conversion_rate?: number | null
          avg_roas?: number | null
          calculated_at?: string | null
          call_to_action?: string | null
          channel?: string
          confidence_level?: number | null
          created_at?: string | null
          effectiveness_score?: number | null
          emotional_appeal?: string | null
          id?: string
          optimal_day?: number | null
          optimal_hour?: number | null
          organization_id?: string | null
          period_end?: string | null
          period_start?: string | null
          sample_size?: number | null
          tone?: string | null
          topic?: string | null
          updated_at?: string | null
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_performance_learnings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
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
      daily_briefings: {
        Row: {
          breaking_news_clusters: Json | null
          briefing_date: string
          created_at: string
          critical_count: number | null
          executive_orders_summary: Json | null
          executive_summary: string | null
          generated_at: string
          high_count: number | null
          id: string
          key_developments: Json | null
          key_takeaways: string[] | null
          medium_count: number | null
          organization_mentions: Json | null
          organization_mentions_summary: Json | null
          overall_threat_score: number | null
          recommendations: string[] | null
          sent_at: string | null
          state_actions_summary: Json | null
          top_critical_items: Json | null
          top_threats: Json | null
          total_articles: number | null
          total_bills: number | null
          total_executive_orders: number | null
          total_state_actions: number | null
          updated_at: string | null
        }
        Insert: {
          breaking_news_clusters?: Json | null
          briefing_date: string
          created_at?: string
          critical_count?: number | null
          executive_orders_summary?: Json | null
          executive_summary?: string | null
          generated_at?: string
          high_count?: number | null
          id?: string
          key_developments?: Json | null
          key_takeaways?: string[] | null
          medium_count?: number | null
          organization_mentions?: Json | null
          organization_mentions_summary?: Json | null
          overall_threat_score?: number | null
          recommendations?: string[] | null
          sent_at?: string | null
          state_actions_summary?: Json | null
          top_critical_items?: Json | null
          top_threats?: Json | null
          total_articles?: number | null
          total_bills?: number | null
          total_executive_orders?: number | null
          total_state_actions?: number | null
          updated_at?: string | null
        }
        Update: {
          breaking_news_clusters?: Json | null
          briefing_date?: string
          created_at?: string
          critical_count?: number | null
          executive_orders_summary?: Json | null
          executive_summary?: string | null
          generated_at?: string
          high_count?: number | null
          id?: string
          key_developments?: Json | null
          key_takeaways?: string[] | null
          medium_count?: number | null
          organization_mentions?: Json | null
          organization_mentions_summary?: Json | null
          overall_threat_score?: number | null
          recommendations?: string[] | null
          sent_at?: string | null
          state_actions_summary?: Json | null
          top_critical_items?: Json | null
          top_threats?: Json | null
          total_articles?: number | null
          total_bills?: number | null
          total_executive_orders?: number | null
          total_state_actions?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_group_sentiment: {
        Row: {
          affected_group: string
          article_count: number | null
          avg_sentiment: number | null
          change_percentage: number | null
          combined_sentiment: number | null
          created_at: string | null
          date: string
          id: string
          previous_avg_sentiment: number | null
          sentiment_trend: string | null
          social_post_count: number | null
          social_sentiment: number | null
          top_sources: string[] | null
          top_topics: string[] | null
        }
        Insert: {
          affected_group: string
          article_count?: number | null
          avg_sentiment?: number | null
          change_percentage?: number | null
          combined_sentiment?: number | null
          created_at?: string | null
          date: string
          id?: string
          previous_avg_sentiment?: number | null
          sentiment_trend?: string | null
          social_post_count?: number | null
          social_sentiment?: number | null
          top_sources?: string[] | null
          top_topics?: string[] | null
        }
        Update: {
          affected_group?: string
          article_count?: number | null
          avg_sentiment?: number | null
          change_percentage?: number | null
          combined_sentiment?: number | null
          created_at?: string | null
          date?: string
          id?: string
          previous_avg_sentiment?: number | null
          sentiment_trend?: string | null
          social_post_count?: number | null
          social_sentiment?: number | null
          top_sources?: string[] | null
          top_topics?: string[] | null
        }
        Relationships: []
      }
      data_freshness_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          expected_freshness_hours: number | null
          hours_stale: number | null
          id: string
          is_resolved: boolean | null
          last_data_date: string | null
          organization_id: string | null
          platform: string
          resolved_at: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          expected_freshness_hours?: number | null
          hours_stale?: number | null
          id?: string
          is_resolved?: boolean | null
          last_data_date?: string | null
          organization_id?: string | null
          platform: string
          resolved_at?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          expected_freshness_hours?: number | null
          hours_stale?: number | null
          id?: string
          is_resolved?: boolean | null
          last_data_date?: string | null
          organization_id?: string | null
          platform?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_freshness_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      detected_anomalies: {
        Row: {
          alert_sent: boolean | null
          anomaly_type: string
          baseline_value: number | null
          created_at: string | null
          current_value: number | null
          detected_at: string | null
          entity_id: string
          entity_name: string
          entity_type: string
          id: string
          metadata: Json | null
          resolved_at: string | null
          severity: string | null
          z_score: number
        }
        Insert: {
          alert_sent?: boolean | null
          anomaly_type: string
          baseline_value?: number | null
          created_at?: string | null
          current_value?: number | null
          detected_at?: string | null
          entity_id: string
          entity_name: string
          entity_type: string
          id?: string
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string | null
          z_score: number
        }
        Update: {
          alert_sent?: boolean | null
          anomaly_type?: string
          baseline_value?: number | null
          created_at?: string | null
          current_value?: number | null
          detected_at?: string | null
          entity_id?: string
          entity_name?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          resolved_at?: string | null
          severity?: string | null
          z_score?: number
        }
        Relationships: []
      }
      donor_demographics: {
        Row: {
          address: string | null
          age: number | null
          bigquery_id: string | null
          bigquery_synced_at: string | null
          city: string | null
          country: string | null
          created_at: string | null
          donation_count: number | null
          donor_email: string
          employer: string | null
          first_donation_date: string | null
          first_name: string | null
          gender: string | null
          id: string
          is_recurring: boolean | null
          last_donation_date: string | null
          last_name: string | null
          occupation: string | null
          organization_id: string | null
          party_affiliation: string | null
          phone: string | null
          state: string | null
          total_donated: number | null
          updated_at: string | null
          voter_file_match_date: string | null
          voter_file_matched: boolean | null
          voter_score: number | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          age?: number | null
          bigquery_id?: string | null
          bigquery_synced_at?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          donation_count?: number | null
          donor_email: string
          employer?: string | null
          first_donation_date?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          is_recurring?: boolean | null
          last_donation_date?: string | null
          last_name?: string | null
          occupation?: string | null
          organization_id?: string | null
          party_affiliation?: string | null
          phone?: string | null
          state?: string | null
          total_donated?: number | null
          updated_at?: string | null
          voter_file_match_date?: string | null
          voter_file_matched?: boolean | null
          voter_score?: number | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          age?: number | null
          bigquery_id?: string | null
          bigquery_synced_at?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          donation_count?: number | null
          donor_email?: string
          employer?: string | null
          first_donation_date?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          is_recurring?: boolean | null
          last_donation_date?: string | null
          last_name?: string | null
          occupation?: string | null
          organization_id?: string | null
          party_affiliation?: string | null
          phone?: string | null
          state?: string | null
          total_donated?: number | null
          updated_at?: string | null
          voter_file_match_date?: string | null
          voter_file_matched?: boolean | null
          voter_score?: number | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donor_demographics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          attachments: Json | null
          created_at: string
          error_message: string | null
          html_body: string
          id: string
          max_retries: number | null
          priority: number | null
          retry_count: number | null
          scheduled_for: string | null
          sent_at: string | null
          status: string | null
          subject: string
          text_body: string | null
          to_emails: string[]
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          error_message?: string | null
          html_body: string
          id?: string
          max_retries?: number | null
          priority?: number | null
          retry_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          text_body?: string | null
          to_emails: string[]
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          error_message?: string | null
          html_body?: string
          id?: string
          max_retries?: number | null
          priority?: number | null
          retry_count?: number | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          text_body?: string | null
          to_emails?: string[]
        }
        Relationships: []
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
      entity_aliases: {
        Row: {
          canonical_name: string
          confidence_score: number | null
          created_at: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          raw_name: string
          resolution_method: string
          source: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          canonical_name: string
          confidence_score?: number | null
          created_at?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          raw_name: string
          resolution_method?: string
          source?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          canonical_name?: string
          confidence_score?: number | null
          created_at?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          raw_name?: string
          resolution_method?: string
          source?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      entity_mentions: {
        Row: {
          context_snippet: string | null
          created_at: string | null
          entity_name: string
          entity_type: string | null
          id: string
          mentioned_at: string
          platform_engagement: Json | null
          sentiment: number | null
          source_id: string
          source_title: string | null
          source_type: string
          source_url: string | null
        }
        Insert: {
          context_snippet?: string | null
          created_at?: string | null
          entity_name: string
          entity_type?: string | null
          id?: string
          mentioned_at: string
          platform_engagement?: Json | null
          sentiment?: number | null
          source_id: string
          source_title?: string | null
          source_type: string
          source_url?: string | null
        }
        Update: {
          context_snippet?: string | null
          created_at?: string | null
          entity_name?: string
          entity_type?: string | null
          id?: string
          mentioned_at?: string
          platform_engagement?: Json | null
          sentiment?: number | null
          source_id?: string
          source_title?: string | null
          source_type?: string
          source_url?: string | null
        }
        Relationships: []
      }
      entity_trends: {
        Row: {
          calculated_at: string | null
          entity_name: string
          entity_type: string | null
          first_seen_at: string | null
          id: string
          is_trending: boolean | null
          last_seen_at: string | null
          mentions_1h: number | null
          mentions_24h: number | null
          mentions_6h: number | null
          mentions_7d: number | null
          sentiment_avg: number | null
          sentiment_change: number | null
          updated_at: string | null
          velocity: number | null
        }
        Insert: {
          calculated_at?: string | null
          entity_name: string
          entity_type?: string | null
          first_seen_at?: string | null
          id?: string
          is_trending?: boolean | null
          last_seen_at?: string | null
          mentions_1h?: number | null
          mentions_24h?: number | null
          mentions_6h?: number | null
          mentions_7d?: number | null
          sentiment_avg?: number | null
          sentiment_change?: number | null
          updated_at?: string | null
          velocity?: number | null
        }
        Update: {
          calculated_at?: string | null
          entity_name?: string
          entity_type?: string | null
          first_seen_at?: string | null
          id?: string
          is_trending?: boolean | null
          last_seen_at?: string | null
          mentions_1h?: number | null
          mentions_24h?: number | null
          mentions_6h?: number | null
          mentions_7d?: number | null
          sentiment_avg?: number | null
          sentiment_change?: number | null
          updated_at?: string | null
          velocity?: number | null
        }
        Relationships: []
      }
      entity_watchlist: {
        Row: {
          alert_threshold: number | null
          aliases: string[] | null
          created_at: string | null
          created_by: string | null
          entity_name: string
          entity_type: string
          id: string
          is_active: boolean | null
          organization_id: string | null
          relevance_score: number | null
          sentiment_alert: boolean | null
          updated_at: string | null
        }
        Insert: {
          alert_threshold?: number | null
          aliases?: string[] | null
          created_at?: string | null
          created_by?: string | null
          entity_name: string
          entity_type: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          relevance_score?: number | null
          sentiment_alert?: boolean | null
          updated_at?: string | null
        }
        Update: {
          alert_threshold?: number | null
          aliases?: string[] | null
          created_at?: string | null
          created_by?: string | null
          entity_name?: string
          entity_type?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          relevance_score?: number | null
          sentiment_alert?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entity_watchlist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_impact_correlations: {
        Row: {
          amount_raised_48h_after: number
          avg_donation_48h_after: number
          baseline_amount: number
          baseline_avg_donation: number
          baseline_donations: number
          correlation_strength: number
          created_at: string
          donations_48h_after: number
          entity_name: string
          entity_type: string
          event_date: string
          id: string
          organization_id: string
          topic_mentions: number | null
          topic_velocity: number | null
        }
        Insert: {
          amount_raised_48h_after?: number
          avg_donation_48h_after?: number
          baseline_amount?: number
          baseline_avg_donation?: number
          baseline_donations?: number
          correlation_strength?: number
          created_at?: string
          donations_48h_after?: number
          entity_name: string
          entity_type: string
          event_date: string
          id?: string
          organization_id: string
          topic_mentions?: number | null
          topic_velocity?: number | null
        }
        Update: {
          amount_raised_48h_after?: number
          avg_donation_48h_after?: number
          baseline_amount?: number
          baseline_avg_donation?: number
          baseline_donations?: number
          correlation_strength?: number
          created_at?: string
          donations_48h_after?: number
          entity_name?: string
          entity_type?: string
          event_date?: string
          id?: string
          organization_id?: string
          topic_mentions?: number | null
          topic_velocity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_impact_correlations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      evergreen_topics: {
        Row: {
          category: string
          created_at: string | null
          id: string
          topic: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          id?: string
          topic: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          topic?: string
        }
        Relationships: []
      }
      executive_orders: {
        Row: {
          created_at: string
          effective_date: string | null
          full_text: string | null
          id: string
          issued_date: string
          issuing_authority: string
          jurisdiction: string
          order_number: string
          relevance_score: number | null
          source_url: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          effective_date?: string | null
          full_text?: string | null
          id?: string
          issued_date: string
          issuing_authority: string
          jurisdiction: string
          order_number: string
          relevance_score?: number | null
          source_url?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          effective_date?: string | null
          full_text?: string | null
          id?: string
          issued_date?: string
          issuing_authority?: string
          jurisdiction?: string
          order_number?: string
          relevance_score?: number | null
          source_url?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      export_templates: {
        Row: {
          columns: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          filters: Json | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          template_name: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          columns: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          template_name: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          columns?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          template_name?: string
          template_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      fundraising_opportunities: {
        Row: {
          created_at: string
          current_mentions: number | null
          detected_at: string
          entity_name: string
          entity_type: string
          estimated_value: number | null
          expires_at: string
          historical_success_rate: number | null
          id: string
          is_active: boolean
          opportunity_score: number
          organization_id: string
          sample_sources: Json | null
          similar_past_events: number | null
          time_sensitivity: number | null
          updated_at: string
          velocity: number | null
        }
        Insert: {
          created_at?: string
          current_mentions?: number | null
          detected_at?: string
          entity_name: string
          entity_type: string
          estimated_value?: number | null
          expires_at: string
          historical_success_rate?: number | null
          id?: string
          is_active?: boolean
          opportunity_score: number
          organization_id: string
          sample_sources?: Json | null
          similar_past_events?: number | null
          time_sensitivity?: number | null
          updated_at?: string
          velocity?: number | null
        }
        Update: {
          created_at?: string
          current_mentions?: number | null
          detected_at?: string
          entity_name?: string
          entity_type?: string
          estimated_value?: number | null
          expires_at?: string
          historical_success_rate?: number | null
          id?: string
          is_active?: boolean
          opportunity_score?: number
          organization_id?: string
          sample_sources?: Json | null
          similar_past_events?: number | null
          time_sensitivity?: number | null
          updated_at?: string
          velocity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fundraising_opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_campaign_messages: {
        Row: {
          actual_performance: number | null
          context_used: Json | null
          created_at: string
          entity_name: string
          entity_type: string
          generated_at: string
          id: string
          message_approach: string | null
          message_text: string
          organization_id: string
          predicted_performance: number | null
          variant_number: number | null
          was_used: boolean | null
        }
        Insert: {
          actual_performance?: number | null
          context_used?: Json | null
          created_at?: string
          entity_name: string
          entity_type: string
          generated_at?: string
          id?: string
          message_approach?: string | null
          message_text: string
          organization_id: string
          predicted_performance?: number | null
          variant_number?: number | null
          was_used?: boolean | null
        }
        Update: {
          actual_performance?: number | null
          context_used?: Json | null
          created_at?: string
          entity_name?: string
          entity_type?: string
          generated_at?: string
          id?: string
          message_approach?: string | null
          message_text?: string
          organization_id?: string
          predicted_performance?: number | null
          variant_number?: number | null
          was_used?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_campaign_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_reports: {
        Row: {
          completed_at: string | null
          created_at: string | null
          date_range_end: string | null
          date_range_start: string | null
          error_message: string | null
          file_size_bytes: number | null
          file_url: string | null
          filters: Json | null
          generated_by: string | null
          id: string
          metadata: Json | null
          page_count: number | null
          report_format: string
          report_name: string
          report_type: string
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          filters?: Json | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          page_count?: number | null
          report_format: string
          report_name: string
          report_type: string
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          filters?: Json | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          page_count?: number | null
          report_format?: string
          report_name?: string
          report_type?: string
          status?: string | null
        }
        Relationships: []
      }
      google_news_articles: {
        Row: {
          ai_processed: boolean | null
          ai_sentiment: number | null
          ai_sentiment_label: string | null
          ai_topics: string[] | null
          created_at: string | null
          description: string | null
          duplicate_of: string | null
          extracted_hashtags: string[] | null
          id: string
          is_duplicate: boolean | null
          published_at: string
          relevance_score: number | null
          source_name: string
          source_url: string | null
          title: string
          title_hash: string | null
          updated_at: string | null
          url: string
          url_hash: string | null
        }
        Insert: {
          ai_processed?: boolean | null
          ai_sentiment?: number | null
          ai_sentiment_label?: string | null
          ai_topics?: string[] | null
          created_at?: string | null
          description?: string | null
          duplicate_of?: string | null
          extracted_hashtags?: string[] | null
          id?: string
          is_duplicate?: boolean | null
          published_at: string
          relevance_score?: number | null
          source_name: string
          source_url?: string | null
          title: string
          title_hash?: string | null
          updated_at?: string | null
          url: string
          url_hash?: string | null
        }
        Update: {
          ai_processed?: boolean | null
          ai_sentiment?: number | null
          ai_sentiment_label?: string | null
          ai_topics?: string[] | null
          created_at?: string | null
          description?: string | null
          duplicate_of?: string | null
          extracted_hashtags?: string[] | null
          id?: string
          is_duplicate?: boolean | null
          published_at?: string
          relevance_score?: number | null
          source_name?: string
          source_url?: string | null
          title?: string
          title_hash?: string | null
          updated_at?: string | null
          url?: string
          url_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_news_articles_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "google_news_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      government_announcements: {
        Row: {
          agency: string
          announcement_type: string
          content: string | null
          created_at: string
          id: string
          published_date: string
          relevance_score: number | null
          source_url: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          agency: string
          announcement_type: string
          content?: string | null
          created_at?: string
          id?: string
          published_date: string
          relevance_score?: number | null
          source_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          agency?: string
          announcement_type?: string
          content?: string | null
          created_at?: string
          id?: string
          published_date?: string
          relevance_score?: number | null
          source_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          execution_log: Json | null
          id: string
          items_created: number | null
          items_processed: number | null
          job_id: string | null
          result: Json | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_log?: Json | null
          id?: string
          items_created?: number | null
          items_processed?: number | null
          job_id?: string | null
          result?: Json | null
          started_at?: string
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          execution_log?: Json | null
          id?: string
          items_created?: number | null
          items_processed?: number | null
          job_id?: string | null
          result?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_executions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scheduled_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_failures: {
        Row: {
          context: Json | null
          context_data: Json | null
          created_at: string | null
          error_message: string | null
          error_stack: string | null
          function_name: string
          id: string
          is_resolved: boolean | null
          job_name: string | null
          last_retry_at: string | null
          max_retries: number | null
          next_retry_at: string | null
          resolved_at: string | null
          retry_count: number | null
        }
        Insert: {
          context?: Json | null
          context_data?: Json | null
          created_at?: string | null
          error_message?: string | null
          error_stack?: string | null
          function_name: string
          id?: string
          is_resolved?: boolean | null
          job_name?: string | null
          last_retry_at?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          resolved_at?: string | null
          retry_count?: number | null
        }
        Update: {
          context?: Json | null
          context_data?: Json | null
          created_at?: string | null
          error_message?: string | null
          error_stack?: string | null
          function_name?: string
          id?: string
          is_resolved?: boolean | null
          job_name?: string | null
          last_retry_at?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          resolved_at?: string | null
          retry_count?: number | null
        }
        Relationships: []
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
      magic_moment_cards: {
        Row: {
          action_label: string | null
          action_url: string | null
          card_type: string
          created_at: string | null
          description: string | null
          dismissed_at: string | null
          dismissed_by: string | null
          expires_at: string | null
          id: string
          is_dismissed: boolean | null
          metadata: Json | null
          organization_id: string
          priority: string | null
          title: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          card_type?: string
          created_at?: string | null
          description?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          metadata?: Json | null
          organization_id: string
          priority?: string | null
          title: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          card_type?: string
          created_at?: string | null
          description?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          expires_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          metadata?: Json | null
          organization_id?: string
          priority?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "magic_moment_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
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
      meta_creative_insights: {
        Row: {
          ad_id: string | null
          ai_model_used: string | null
          analysis_confidence: number | null
          analyzed_at: string | null
          audio_transcript: string | null
          call_to_action_type: string | null
          campaign_id: string
          clicks: number | null
          conversion_value: number | null
          conversions: number | null
          created_at: string | null
          creative_id: string | null
          creative_type: string | null
          ctr: number | null
          description: string | null
          emotional_appeal: string | null
          headline: string | null
          id: string
          impressions: number | null
          key_themes: string[] | null
          organization_id: string
          primary_text: string | null
          roas: number | null
          sentiment_label: string | null
          sentiment_score: number | null
          spend: number | null
          thumbnail_url: string | null
          tone: string | null
          topic: string | null
          transcript_confidence: number | null
          updated_at: string | null
          urgency_level: string | null
          video_url: string | null
        }
        Insert: {
          ad_id?: string | null
          ai_model_used?: string | null
          analysis_confidence?: number | null
          analyzed_at?: string | null
          audio_transcript?: string | null
          call_to_action_type?: string | null
          campaign_id: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          created_at?: string | null
          creative_id?: string | null
          creative_type?: string | null
          ctr?: number | null
          description?: string | null
          emotional_appeal?: string | null
          headline?: string | null
          id?: string
          impressions?: number | null
          key_themes?: string[] | null
          organization_id: string
          primary_text?: string | null
          roas?: number | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          spend?: number | null
          thumbnail_url?: string | null
          tone?: string | null
          topic?: string | null
          transcript_confidence?: number | null
          updated_at?: string | null
          urgency_level?: string | null
          video_url?: string | null
        }
        Update: {
          ad_id?: string | null
          ai_model_used?: string | null
          analysis_confidence?: number | null
          analyzed_at?: string | null
          audio_transcript?: string | null
          call_to_action_type?: string | null
          campaign_id?: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          created_at?: string | null
          creative_id?: string | null
          creative_type?: string | null
          ctr?: number | null
          description?: string | null
          emotional_appeal?: string | null
          headline?: string | null
          id?: string
          impressions?: number | null
          key_themes?: string[] | null
          organization_id?: string
          primary_text?: string | null
          roas?: number | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          spend?: number | null
          thumbnail_url?: string | null
          tone?: string | null
          topic?: string | null
          transcript_confidence?: number | null
          updated_at?: string | null
          urgency_level?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_creative_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_frequency: string | null
          email_notifications: boolean | null
          id: string
          notify_bill_updates: boolean | null
          notify_bookmarked_articles: boolean | null
          notify_new_articles: boolean | null
          notify_new_bills: boolean | null
          push_notifications: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_frequency?: string | null
          email_notifications?: boolean | null
          id?: string
          notify_bill_updates?: boolean | null
          notify_bookmarked_articles?: boolean | null
          notify_new_articles?: boolean | null
          notify_new_bills?: boolean | null
          push_notifications?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_frequency?: string | null
          email_notifications?: boolean | null
          id?: string
          notify_bill_updates?: boolean | null
          notify_bookmarked_articles?: boolean | null
          notify_new_articles?: boolean | null
          notify_new_bills?: boolean | null
          push_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          link: string | null
          message: string
          read: boolean | null
          sent_via: string[] | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          sent_via?: string[] | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          sent_via?: string[] | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_mentions: {
        Row: {
          created_at: string
          id: string
          mention_context: string
          mentioned_at: string
          organization_abbrev: string | null
          organization_name: string
          relevance_score: number | null
          sentiment: string | null
          source_id: string
          source_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          mention_context: string
          mentioned_at: string
          organization_abbrev?: string | null
          organization_name: string
          relevance_score?: number | null
          sentiment?: string | null
          source_id: string
          source_type: string
        }
        Update: {
          created_at?: string
          id?: string
          mention_context?: string
          mentioned_at?: string
          organization_abbrev?: string | null
          organization_name?: string
          relevance_score?: number | null
          sentiment?: string | null
          source_id?: string
          source_type?: string
        }
        Relationships: []
      }
      organization_profiles: {
        Row: {
          ai_extracted_data: Json | null
          created_at: string | null
          focus_areas: string[] | null
          id: string
          key_issues: string[] | null
          mission_summary: string | null
          organization_id: string | null
          related_orgs: string[] | null
          scraped_at: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          ai_extracted_data?: Json | null
          created_at?: string | null
          focus_areas?: string[] | null
          id?: string
          key_issues?: string[] | null
          mission_summary?: string | null
          organization_id?: string | null
          related_orgs?: string[] | null
          scraped_at?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          ai_extracted_data?: Json | null
          created_at?: string | null
          focus_areas?: string[] | null
          id?: string
          key_issues?: string[] | null
          mission_summary?: string | null
          organization_id?: string | null
          related_orgs?: string[] | null
          scraped_at?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      polling_alert_configs: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          notify_email: boolean
          notify_in_app: boolean
          organization_id: string
          poll_type: string
          state: string | null
          threshold_percentage: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          notify_email?: boolean
          notify_in_app?: boolean
          organization_id: string
          poll_type: string
          state?: string | null
          threshold_percentage?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          notify_email?: boolean
          notify_in_app?: boolean
          organization_id?: string
          poll_type?: string
          state?: string | null
          threshold_percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "polling_alert_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      polling_alerts: {
        Row: {
          alert_type: string
          change_amount: number | null
          created_at: string | null
          current_value: number | null
          description: string | null
          id: string
          is_read: boolean | null
          poll_type: string
          previous_value: number | null
          race_id: string | null
          severity: string | null
          state: string | null
        }
        Insert: {
          alert_type: string
          change_amount?: number | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          is_read?: boolean | null
          poll_type: string
          previous_value?: number | null
          race_id?: string | null
          severity?: string | null
          state?: string | null
        }
        Update: {
          alert_type?: string
          change_amount?: number | null
          created_at?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          is_read?: boolean | null
          poll_type?: string
          previous_value?: number | null
          race_id?: string | null
          severity?: string | null
          state?: string | null
        }
        Relationships: []
      }
      polling_data: {
        Row: {
          candidate_name: string | null
          created_at: string | null
          district: string | null
          fetched_at: string | null
          field_dates: Json | null
          id: string
          issue_name: string | null
          lead_margin: number | null
          margin_of_error: number | null
          poll_date: string | null
          poll_type: string
          pollster: string | null
          race_id: string | null
          raw_data: Json | null
          result_value: number | null
          sample_size: number | null
          source: string
          source_url: string | null
          state: string | null
        }
        Insert: {
          candidate_name?: string | null
          created_at?: string | null
          district?: string | null
          fetched_at?: string | null
          field_dates?: Json | null
          id?: string
          issue_name?: string | null
          lead_margin?: number | null
          margin_of_error?: number | null
          poll_date?: string | null
          poll_type: string
          pollster?: string | null
          race_id?: string | null
          raw_data?: Json | null
          result_value?: number | null
          sample_size?: number | null
          source: string
          source_url?: string | null
          state?: string | null
        }
        Update: {
          candidate_name?: string | null
          created_at?: string | null
          district?: string | null
          fetched_at?: string | null
          field_dates?: Json | null
          id?: string
          issue_name?: string | null
          lead_margin?: number | null
          margin_of_error?: number | null
          poll_date?: string | null
          poll_type?: string
          pollster?: string | null
          race_id?: string | null
          raw_data?: Json | null
          result_value?: number | null
          sample_size?: number | null
          source?: string
          source_url?: string | null
          state?: string | null
        }
        Relationships: []
      }
      processing_batches: {
        Row: {
          ai_tokens_used: number | null
          batch_type: string
          clusters_created: number | null
          completed_at: string | null
          duplicates_removed: number | null
          id: string
          items_count: number | null
          processing_time_ms: number | null
          started_at: string | null
          status: string | null
          unique_items: number | null
        }
        Insert: {
          ai_tokens_used?: number | null
          batch_type: string
          clusters_created?: number | null
          completed_at?: string | null
          duplicates_removed?: number | null
          id?: string
          items_count?: number | null
          processing_time_ms?: number | null
          started_at?: string | null
          status?: string | null
          unique_items?: number | null
        }
        Update: {
          ai_tokens_used?: number | null
          batch_type?: string
          clusters_created?: number | null
          completed_at?: string | null
          duplicates_removed?: number | null
          id?: string
          items_count?: number | null
          processing_time_ms?: number | null
          started_at?: string | null
          status?: string | null
          unique_items?: number | null
        }
        Relationships: []
      }
      processing_checkpoints: {
        Row: {
          function_name: string
          last_processed_at: string | null
          last_processed_id: string | null
          records_processed: number | null
          updated_at: string | null
        }
        Insert: {
          function_name: string
          last_processed_at?: string | null
          last_processed_id?: string | null
          records_processed?: number | null
          updated_at?: string | null
        }
        Update: {
          function_name?: string
          last_processed_at?: string | null
          last_processed_id?: string | null
          records_processed?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_sign_in_at: string | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          last_sign_in_at?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_sign_in_at?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reddit_posts: {
        Row: {
          ai_processed: boolean | null
          ai_sentiment: number | null
          ai_sentiment_label: string | null
          ai_topics: string[] | null
          author: string | null
          created_at: string | null
          created_utc: string
          downvotes: number | null
          id: string
          is_duplicate: boolean | null
          num_comments: number | null
          permalink: string | null
          reddit_id: string
          relevance_score: number | null
          score: number | null
          selftext: string | null
          subreddit: string
          title: string
          title_hash: string | null
          updated_at: string | null
          upvotes: number | null
          url: string | null
        }
        Insert: {
          ai_processed?: boolean | null
          ai_sentiment?: number | null
          ai_sentiment_label?: string | null
          ai_topics?: string[] | null
          author?: string | null
          created_at?: string | null
          created_utc: string
          downvotes?: number | null
          id?: string
          is_duplicate?: boolean | null
          num_comments?: number | null
          permalink?: string | null
          reddit_id: string
          relevance_score?: number | null
          score?: number | null
          selftext?: string | null
          subreddit: string
          title: string
          title_hash?: string | null
          updated_at?: string | null
          upvotes?: number | null
          url?: string | null
        }
        Update: {
          ai_processed?: boolean | null
          ai_sentiment?: number | null
          ai_sentiment_label?: string | null
          ai_topics?: string[] | null
          author?: string | null
          created_at?: string | null
          created_utc?: string
          downvotes?: number | null
          id?: string
          is_duplicate?: boolean | null
          num_comments?: number | null
          permalink?: string | null
          reddit_id?: string
          relevance_score?: number | null
          score?: number | null
          selftext?: string | null
          subreddit?: string
          title?: string
          title_hash?: string | null
          updated_at?: string | null
          upvotes?: number | null
          url?: string | null
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
      rss_sources: {
        Row: {
          category: string
          consecutive_errors: number | null
          created_at: string | null
          error_count: number | null
          fetch_error: string | null
          fetch_frequency_minutes: number | null
          geographic_scope: string | null
          id: string
          is_active: boolean | null
          last_error_message: string | null
          last_fetch_status: string | null
          last_fetched_at: string | null
          logo_url: string | null
          name: string
          political_leaning: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          category: string
          consecutive_errors?: number | null
          created_at?: string | null
          error_count?: number | null
          fetch_error?: string | null
          fetch_frequency_minutes?: number | null
          geographic_scope?: string | null
          id?: string
          is_active?: boolean | null
          last_error_message?: string | null
          last_fetch_status?: string | null
          last_fetched_at?: string | null
          logo_url?: string | null
          name: string
          political_leaning?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          category?: string
          consecutive_errors?: number | null
          created_at?: string | null
          error_count?: number | null
          fetch_error?: string | null
          fetch_frequency_minutes?: number | null
          geographic_scope?: string | null
          id?: string
          is_active?: boolean | null
          last_error_message?: string | null
          last_fetch_status?: string | null
          last_fetched_at?: string | null
          logo_url?: string | null
          name?: string
          political_leaning?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      scheduled_jobs: {
        Row: {
          circuit_failure_threshold: number | null
          circuit_opened_at: string | null
          consecutive_failures: number | null
          created_at: string
          endpoint: string
          id: string
          is_active: boolean | null
          is_circuit_open: boolean | null
          job_name: string
          job_type: string
          last_error: string | null
          last_run_at: string | null
          last_run_duration_ms: number | null
          last_run_status: string | null
          next_run_at: string | null
          payload: Json | null
          schedule: string
          updated_at: string
        }
        Insert: {
          circuit_failure_threshold?: number | null
          circuit_opened_at?: string | null
          consecutive_failures?: number | null
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean | null
          is_circuit_open?: boolean | null
          job_name: string
          job_type: string
          last_error?: string | null
          last_run_at?: string | null
          last_run_duration_ms?: number | null
          last_run_status?: string | null
          next_run_at?: string | null
          payload?: Json | null
          schedule: string
          updated_at?: string
        }
        Update: {
          circuit_failure_threshold?: number | null
          circuit_opened_at?: string | null
          consecutive_failures?: number | null
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean | null
          is_circuit_open?: boolean | null
          job_name?: string
          job_type?: string
          last_error?: string | null
          last_run_at?: string | null
          last_run_duration_ms?: number | null
          last_run_status?: string | null
          next_run_at?: string | null
          payload?: Json | null
          schedule?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_reports: {
        Row: {
          created_at: string | null
          filters: Json | null
          id: string
          is_active: boolean | null
          last_generated_at: string | null
          next_generation_at: string | null
          recipients: string[] | null
          report_name: string
          report_type: string
          schedule: string
          schedule_day: number | null
          schedule_time: string | null
          template_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_generated_at?: string | null
          next_generation_at?: string | null
          recipients?: string[] | null
          report_name: string
          report_type: string
          schedule: string
          schedule_day?: number | null
          schedule_time?: string | null
          template_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_generated_at?: string | null
          next_generation_at?: string | null
          recipients?: string[] | null
          report_name?: string
          report_type?: string
          schedule?: string
          schedule_day?: number | null
          schedule_time?: string | null
          template_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_reports_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "export_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      send_time_optimizations: {
        Row: {
          analyzed_at: string
          best_days_of_week: string[] | null
          best_hours_of_day: number[] | null
          created_at: string
          daily_performance: Json | null
          hourly_performance: Json | null
          id: string
          optimal_windows: Json | null
          organization_id: string
          sample_size: number | null
        }
        Insert: {
          analyzed_at: string
          best_days_of_week?: string[] | null
          best_hours_of_day?: number[] | null
          created_at?: string
          daily_performance?: Json | null
          hourly_performance?: Json | null
          id?: string
          optimal_windows?: Json | null
          organization_id: string
          sample_size?: number | null
        }
        Update: {
          analyzed_at?: string
          best_days_of_week?: string[] | null
          best_hours_of_day?: number[] | null
          created_at?: string
          daily_performance?: Json | null
          hourly_performance?: Json | null
          id?: string
          optimal_windows?: Json | null
          organization_id?: string
          sample_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "send_time_optimizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sentiment_snapshots: {
        Row: {
          affected_group: string
          avg_sentiment: number | null
          created_at: string | null
          id: string
          negative_count: number | null
          neutral_count: number | null
          platform: string
          positive_count: number | null
          snapshot_date: string
          total_mentions: number | null
        }
        Insert: {
          affected_group: string
          avg_sentiment?: number | null
          created_at?: string | null
          id?: string
          negative_count?: number | null
          neutral_count?: number | null
          platform: string
          positive_count?: number | null
          snapshot_date: string
          total_mentions?: number | null
        }
        Update: {
          affected_group?: string
          avg_sentiment?: number | null
          created_at?: string | null
          id?: string
          negative_count?: number | null
          neutral_count?: number | null
          platform?: string
          positive_count?: number | null
          snapshot_date?: string
          total_mentions?: number | null
        }
        Relationships: []
      }
      sentiment_trends: {
        Row: {
          avg_sentiment_score: number | null
          category: string
          created_at: string | null
          date: string
          id: string
          negative_count: number | null
          neutral_count: number | null
          positive_count: number | null
        }
        Insert: {
          avg_sentiment_score?: number | null
          category: string
          created_at?: string | null
          date: string
          id?: string
          negative_count?: number | null
          neutral_count?: number | null
          positive_count?: number | null
        }
        Update: {
          avg_sentiment_score?: number | null
          category?: string
          created_at?: string | null
          date?: string
          id?: string
          negative_count?: number | null
          neutral_count?: number | null
          positive_count?: number | null
        }
        Relationships: []
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
      sms_campaigns: {
        Row: {
          amount_raised: number | null
          campaign_id: string
          campaign_name: string | null
          clicks: number | null
          conversions: number | null
          cost: number | null
          created_at: string | null
          id: string
          message_text: string | null
          messages_delivered: number | null
          messages_failed: number | null
          messages_sent: number | null
          opt_outs: number | null
          organization_id: string
          phone_list_name: string | null
          previously_opted_out: number | null
          replies: number | null
          send_date: string | null
          skipped: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount_raised?: number | null
          campaign_id: string
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cost?: number | null
          created_at?: string | null
          id?: string
          message_text?: string | null
          messages_delivered?: number | null
          messages_failed?: number | null
          messages_sent?: number | null
          opt_outs?: number | null
          organization_id: string
          phone_list_name?: string | null
          previously_opted_out?: number | null
          replies?: number | null
          send_date?: string | null
          skipped?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_raised?: number | null
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cost?: number | null
          created_at?: string | null
          id?: string
          message_text?: string | null
          messages_delivered?: number | null
          messages_failed?: number | null
          messages_sent?: number | null
          opt_outs?: number | null
          organization_id?: string
          phone_list_name?: string | null
          previously_opted_out?: number | null
          replies?: number | null
          send_date?: string | null
          skipped?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_creative_insights: {
        Row: {
          ai_model_used: string | null
          amount_raised: number | null
          analysis_confidence: number | null
          analyzed_at: string | null
          call_to_action: string | null
          campaign_id: string
          campaign_name: string | null
          click_rate: number | null
          clicks: number | null
          conversion_rate: number | null
          conversions: number | null
          created_at: string | null
          id: string
          key_themes: string[] | null
          message_text: string
          messages_delivered: number | null
          messages_sent: number | null
          organization_id: string
          send_date: string | null
          send_day_of_week: number | null
          send_hour: number | null
          sentiment_label: string | null
          sentiment_score: number | null
          tone: string | null
          topic: string | null
          updated_at: string | null
          urgency_level: string | null
        }
        Insert: {
          ai_model_used?: string | null
          amount_raised?: number | null
          analysis_confidence?: number | null
          analyzed_at?: string | null
          call_to_action?: string | null
          campaign_id: string
          campaign_name?: string | null
          click_rate?: number | null
          clicks?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          id?: string
          key_themes?: string[] | null
          message_text: string
          messages_delivered?: number | null
          messages_sent?: number | null
          organization_id: string
          send_date?: string | null
          send_day_of_week?: number | null
          send_hour?: number | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          tone?: string | null
          topic?: string | null
          updated_at?: string | null
          urgency_level?: string | null
        }
        Update: {
          ai_model_used?: string | null
          amount_raised?: number | null
          analysis_confidence?: number | null
          analyzed_at?: string | null
          call_to_action?: string | null
          campaign_id?: string
          campaign_name?: string | null
          click_rate?: number | null
          clicks?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          id?: string
          key_themes?: string[] | null
          message_text?: string
          messages_delivered?: number | null
          messages_sent?: number | null
          organization_id?: string
          send_date?: string | null
          send_day_of_week?: number | null
          send_hour?: number | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          tone?: string | null
          topic?: string | null
          updated_at?: string | null
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_creative_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      social_velocity_snapshots: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          metric_type: string
          metric_value: number
          snapshot_time: string
          topic: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_value: number
          snapshot_time: string
          topic?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number
          snapshot_time?: string
          topic?: string | null
        }
        Relationships: []
      }
      spike_alerts: {
        Row: {
          alert_type: string
          context_summary: string | null
          created_at: string | null
          current_mentions: number
          detected_at: string | null
          entity_name: string
          entity_type: string
          id: string
          last_error: string | null
          notification_channels: string[] | null
          previous_mentions: number
          related_articles: string[] | null
          related_posts: string[] | null
          retry_count: number | null
          sent_at: string | null
          severity: string
          status: string | null
          time_window: string
          velocity_increase: number
        }
        Insert: {
          alert_type: string
          context_summary?: string | null
          created_at?: string | null
          current_mentions: number
          detected_at?: string | null
          entity_name: string
          entity_type: string
          id?: string
          last_error?: string | null
          notification_channels?: string[] | null
          previous_mentions: number
          related_articles?: string[] | null
          related_posts?: string[] | null
          retry_count?: number | null
          sent_at?: string | null
          severity?: string
          status?: string | null
          time_window: string
          velocity_increase: number
        }
        Update: {
          alert_type?: string
          context_summary?: string | null
          created_at?: string | null
          current_mentions?: number
          detected_at?: string | null
          entity_name?: string
          entity_type?: string
          id?: string
          last_error?: string | null
          notification_channels?: string[] | null
          previous_mentions?: number
          related_articles?: string[] | null
          related_posts?: string[] | null
          retry_count?: number | null
          sent_at?: string | null
          severity?: string
          status?: string | null
          time_window?: string
          velocity_increase?: number
        }
        Relationships: []
      }
      state_actions: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          effective_date: string | null
          id: string
          introduced_date: string | null
          relevance_score: number | null
          source_url: string | null
          sponsor: string | null
          state: string
          status: string | null
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          effective_date?: string | null
          id?: string
          introduced_date?: string | null
          relevance_score?: number | null
          source_url?: string | null
          sponsor?: string | null
          state: string
          status?: string | null
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          effective_date?: string | null
          id?: string
          introduced_date?: string | null
          relevance_score?: number | null
          source_url?: string | null
          sponsor?: string | null
          state?: string
          status?: string | null
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      suggested_actions: {
        Row: {
          action_type: string
          alert_id: string | null
          audience_segment: string | null
          created_at: string | null
          entity_name: string | null
          historical_performance: Json | null
          id: string
          organization_id: string | null
          status: string | null
          suggested_copy: string | null
          topic_relevance: number | null
          updated_at: string | null
          urgency_score: number | null
          used_at: string | null
          value_prop: string | null
        }
        Insert: {
          action_type: string
          alert_id?: string | null
          audience_segment?: string | null
          created_at?: string | null
          entity_name?: string | null
          historical_performance?: Json | null
          id?: string
          organization_id?: string | null
          status?: string | null
          suggested_copy?: string | null
          topic_relevance?: number | null
          updated_at?: string | null
          urgency_score?: number | null
          used_at?: string | null
          value_prop?: string | null
        }
        Update: {
          action_type?: string
          alert_id?: string | null
          audience_segment?: string | null
          created_at?: string | null
          entity_name?: string | null
          historical_performance?: Json | null
          id?: string
          organization_id?: string | null
          status?: string | null
          suggested_copy?: string | null
          topic_relevance?: number | null
          updated_at?: string | null
          urgency_score?: number | null
          used_at?: string | null
          value_prop?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggested_actions_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "client_entity_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggested_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      system_health_metrics: {
        Row: {
          component: string | null
          id: string
          measured_at: string | null
          metadata: Json | null
          metric_name: string
          metric_unit: string | null
          metric_value: number | null
        }
        Insert: {
          component?: string | null
          id?: string
          measured_at?: string | null
          metadata?: Json | null
          metric_name: string
          metric_unit?: string | null
          metric_value?: number | null
        }
        Update: {
          component?: string | null
          id?: string
          measured_at?: string | null
          metadata?: Json | null
          metric_name?: string
          metric_unit?: string | null
          metric_value?: number | null
        }
        Relationships: []
      }
      topic_baselines: {
        Row: {
          avg_daily_mentions: number | null
          avg_hourly_mentions: number | null
          baseline_calculated_at: string | null
          created_at: string | null
          data_points: number | null
          id: string
          normalized_name: string
          peak_mentions_24h: number | null
          topic_name: string
          updated_at: string | null
        }
        Insert: {
          avg_daily_mentions?: number | null
          avg_hourly_mentions?: number | null
          baseline_calculated_at?: string | null
          created_at?: string | null
          data_points?: number | null
          id?: string
          normalized_name: string
          peak_mentions_24h?: number | null
          topic_name: string
          updated_at?: string | null
        }
        Update: {
          avg_daily_mentions?: number | null
          avg_hourly_mentions?: number | null
          baseline_calculated_at?: string | null
          created_at?: string | null
          data_points?: number | null
          id?: string
          normalized_name?: string
          peak_mentions_24h?: number | null
          topic_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      transaction_attribution: {
        Row: {
          attribution_calculated_at: string | null
          created_at: string | null
          donor_email: string | null
          first_touch_campaign: string | null
          first_touch_channel: string | null
          first_touch_weight: number | null
          id: string
          last_touch_campaign: string | null
          last_touch_channel: string | null
          last_touch_weight: number | null
          middle_touches: Json | null
          middle_touches_weight: number | null
          organization_id: string | null
          total_touchpoints: number | null
          transaction_id: string
        }
        Insert: {
          attribution_calculated_at?: string | null
          created_at?: string | null
          donor_email?: string | null
          first_touch_campaign?: string | null
          first_touch_channel?: string | null
          first_touch_weight?: number | null
          id?: string
          last_touch_campaign?: string | null
          last_touch_channel?: string | null
          last_touch_weight?: number | null
          middle_touches?: Json | null
          middle_touches_weight?: number | null
          organization_id?: string | null
          total_touchpoints?: number | null
          transaction_id: string
        }
        Update: {
          attribution_calculated_at?: string | null
          created_at?: string | null
          donor_email?: string | null
          first_touch_campaign?: string | null
          first_touch_channel?: string | null
          first_touch_weight?: number | null
          id?: string
          last_touch_campaign?: string | null
          last_touch_channel?: string | null
          last_touch_weight?: number | null
          middle_touches?: Json | null
          middle_touches_weight?: number | null
          organization_id?: string | null
          total_touchpoints?: number | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_attribution_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_anomalies: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          affected_groups: string[] | null
          anomaly_type: string
          context: Json | null
          created_at: string | null
          current_value: number
          detected_at: string | null
          deviation_percentage: number | null
          expected_value: number
          id: string
          is_acknowledged: boolean | null
          severity: string | null
          source_type: string | null
          topic: string
          z_score: number
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          affected_groups?: string[] | null
          anomaly_type: string
          context?: Json | null
          created_at?: string | null
          current_value: number
          detected_at?: string | null
          deviation_percentage?: number | null
          expected_value: number
          id?: string
          is_acknowledged?: boolean | null
          severity?: string | null
          source_type?: string | null
          topic: string
          z_score: number
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          affected_groups?: string[] | null
          anomaly_type?: string
          context?: Json | null
          created_at?: string | null
          current_value?: number
          detected_at?: string | null
          deviation_percentage?: number | null
          expected_value?: number
          id?: string
          is_acknowledged?: boolean | null
          severity?: string | null
          source_type?: string | null
          topic?: string
          z_score?: number
        }
        Relationships: []
      }
      trend_clusters: {
        Row: {
          acceleration: number | null
          article_ids: string[] | null
          bluesky_count: number | null
          bluesky_ids: string[] | null
          cluster_summary: string | null
          cluster_title: string
          created_at: string | null
          cross_source_score: number | null
          dominant_sentiment: string | null
          entity_co_occurrences: Json | null
          entity_type: string | null
          first_seen_at: string | null
          google_news_count: number | null
          google_news_ids: string[] | null
          hashtags: string[] | null
          id: string
          is_breaking: boolean | null
          is_hashtag: boolean | null
          is_trending: boolean | null
          key_entities: string[] | null
          last_activity_at: string | null
          mentions_last_15m: number | null
          mentions_last_24h: number | null
          mentions_last_6h: number | null
          mentions_last_hour: number | null
          momentum: string | null
          peak_at: string | null
          peak_hour: string | null
          reddit_count: number | null
          reddit_ids: string[] | null
          related_topics: string[] | null
          rss_count: number | null
          sentiment_score: number | null
          source_distribution: Json | null
          specificity_score: number | null
          spike_detected_at: string | null
          total_mentions: number | null
          trend_stage: string | null
          trending_since: string | null
          updated_at: string | null
          velocity_1h: number | null
          velocity_6h: number | null
          velocity_score: number | null
        }
        Insert: {
          acceleration?: number | null
          article_ids?: string[] | null
          bluesky_count?: number | null
          bluesky_ids?: string[] | null
          cluster_summary?: string | null
          cluster_title: string
          created_at?: string | null
          cross_source_score?: number | null
          dominant_sentiment?: string | null
          entity_co_occurrences?: Json | null
          entity_type?: string | null
          first_seen_at?: string | null
          google_news_count?: number | null
          google_news_ids?: string[] | null
          hashtags?: string[] | null
          id?: string
          is_breaking?: boolean | null
          is_hashtag?: boolean | null
          is_trending?: boolean | null
          key_entities?: string[] | null
          last_activity_at?: string | null
          mentions_last_15m?: number | null
          mentions_last_24h?: number | null
          mentions_last_6h?: number | null
          mentions_last_hour?: number | null
          momentum?: string | null
          peak_at?: string | null
          peak_hour?: string | null
          reddit_count?: number | null
          reddit_ids?: string[] | null
          related_topics?: string[] | null
          rss_count?: number | null
          sentiment_score?: number | null
          source_distribution?: Json | null
          specificity_score?: number | null
          spike_detected_at?: string | null
          total_mentions?: number | null
          trend_stage?: string | null
          trending_since?: string | null
          updated_at?: string | null
          velocity_1h?: number | null
          velocity_6h?: number | null
          velocity_score?: number | null
        }
        Update: {
          acceleration?: number | null
          article_ids?: string[] | null
          bluesky_count?: number | null
          bluesky_ids?: string[] | null
          cluster_summary?: string | null
          cluster_title?: string
          created_at?: string | null
          cross_source_score?: number | null
          dominant_sentiment?: string | null
          entity_co_occurrences?: Json | null
          entity_type?: string | null
          first_seen_at?: string | null
          google_news_count?: number | null
          google_news_ids?: string[] | null
          hashtags?: string[] | null
          id?: string
          is_breaking?: boolean | null
          is_hashtag?: boolean | null
          is_trending?: boolean | null
          key_entities?: string[] | null
          last_activity_at?: string | null
          mentions_last_15m?: number | null
          mentions_last_24h?: number | null
          mentions_last_6h?: number | null
          mentions_last_hour?: number | null
          momentum?: string | null
          peak_at?: string | null
          peak_hour?: string | null
          reddit_count?: number | null
          reddit_ids?: string[] | null
          related_topics?: string[] | null
          rss_count?: number | null
          sentiment_score?: number | null
          source_distribution?: Json | null
          specificity_score?: number | null
          spike_detected_at?: string | null
          total_mentions?: number | null
          trend_stage?: string | null
          trending_since?: string | null
          updated_at?: string | null
          velocity_1h?: number | null
          velocity_6h?: number | null
          velocity_score?: number | null
        }
        Relationships: []
      }
      trending_news_topics: {
        Row: {
          calculated_at: string | null
          first_seen_at: string | null
          id: string
          is_trending: boolean | null
          last_seen_at: string | null
          mentions_last_24_hours: number | null
          mentions_last_6_hours: number | null
          mentions_last_hour: number | null
          mentions_last_week: number | null
          peak_at: string | null
          peak_velocity: number | null
          related_articles: string[] | null
          related_bluesky_trends: string[] | null
          sentiment_avg: number | null
          sentiment_negative: number | null
          sentiment_neutral: number | null
          sentiment_positive: number | null
          topic: string
          trending_since: string | null
          updated_at: string | null
          velocity: number | null
        }
        Insert: {
          calculated_at?: string | null
          first_seen_at?: string | null
          id?: string
          is_trending?: boolean | null
          last_seen_at?: string | null
          mentions_last_24_hours?: number | null
          mentions_last_6_hours?: number | null
          mentions_last_hour?: number | null
          mentions_last_week?: number | null
          peak_at?: string | null
          peak_velocity?: number | null
          related_articles?: string[] | null
          related_bluesky_trends?: string[] | null
          sentiment_avg?: number | null
          sentiment_negative?: number | null
          sentiment_neutral?: number | null
          sentiment_positive?: number | null
          topic: string
          trending_since?: string | null
          updated_at?: string | null
          velocity?: number | null
        }
        Update: {
          calculated_at?: string | null
          first_seen_at?: string | null
          id?: string
          is_trending?: boolean | null
          last_seen_at?: string | null
          mentions_last_24_hours?: number | null
          mentions_last_6_hours?: number | null
          mentions_last_hour?: number | null
          mentions_last_week?: number | null
          peak_at?: string | null
          peak_velocity?: number | null
          related_articles?: string[] | null
          related_bluesky_trends?: string[] | null
          sentiment_avg?: number | null
          sentiment_negative?: number | null
          sentiment_neutral?: number | null
          sentiment_positive?: number | null
          topic?: string
          trending_since?: string | null
          updated_at?: string | null
          velocity?: number | null
        }
        Relationships: []
      }
      trending_topics: {
        Row: {
          article_ids: string[] | null
          avg_sentiment_score: number | null
          created_at: string | null
          day_date: string
          hour_timestamp: string
          id: string
          mention_count: number
          momentum: number | null
          momentum_score: number | null
          negative_count: number | null
          neutral_count: number | null
          peak_position: number | null
          positive_count: number | null
          related_keywords: string[] | null
          sample_titles: string[] | null
          sentiment_avg: number | null
          sentiment_negative: number | null
          sentiment_neutral: number | null
          sentiment_positive: number | null
          topic: string
          trending_hour: string | null
          updated_at: string | null
          velocity_score: number | null
        }
        Insert: {
          article_ids?: string[] | null
          avg_sentiment_score?: number | null
          created_at?: string | null
          day_date: string
          hour_timestamp: string
          id?: string
          mention_count?: number
          momentum?: number | null
          momentum_score?: number | null
          negative_count?: number | null
          neutral_count?: number | null
          peak_position?: number | null
          positive_count?: number | null
          related_keywords?: string[] | null
          sample_titles?: string[] | null
          sentiment_avg?: number | null
          sentiment_negative?: number | null
          sentiment_neutral?: number | null
          sentiment_positive?: number | null
          topic: string
          trending_hour?: string | null
          updated_at?: string | null
          velocity_score?: number | null
        }
        Update: {
          article_ids?: string[] | null
          avg_sentiment_score?: number | null
          created_at?: string | null
          day_date?: string
          hour_timestamp?: string
          id?: string
          mention_count?: number
          momentum?: number | null
          momentum_score?: number | null
          negative_count?: number | null
          neutral_count?: number | null
          peak_position?: number | null
          positive_count?: number | null
          related_keywords?: string[] | null
          sample_titles?: string[] | null
          sentiment_avg?: number | null
          sentiment_negative?: number | null
          sentiment_neutral?: number | null
          sentiment_positive?: number | null
          topic?: string
          trending_hour?: string | null
          updated_at?: string | null
          velocity_score?: number | null
        }
        Relationships: []
      }
      user_article_preferences: {
        Row: {
          created_at: string | null
          email_frequency: string | null
          id: string
          notification_settings: Json | null
          sms_enabled: boolean | null
          tracked_keywords: string[] | null
          tracked_sources: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_frequency?: string | null
          id?: string
          notification_settings?: Json | null
          sms_enabled?: boolean | null
          tracked_keywords?: string[] | null
          tracked_sources?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_frequency?: string | null
          id?: string
          notification_settings?: Json | null
          sms_enabled?: boolean | null
          tracked_keywords?: string[] | null
          tracked_sources?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      watchlist_usage_log: {
        Row: {
          action: string
          created_at: string | null
          entity_name: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          entity_name?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          entity_name?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_usage_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs: {
        Row: {
          created_at: string
          event_types: string[] | null
          headers: Json | null
          id: string
          is_active: boolean | null
          name: string
          secret: string | null
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          event_types?: string[] | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          secret?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          event_types?: string[] | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          created_at: string
          delivered_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_code: number | null
          retry_count: number | null
          status: string | null
          webhook_id: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_code?: number | null
          retry_count?: number | null
          status?: string | null
          webhook_id?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          retry_count?: number | null
          status?: string | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string | null
          headers: Json | null
          id: string
          organization_id: string | null
          payload: Json | null
          platform: string
          processed_at: string | null
          processing_status: string | null
          received_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          headers?: Json | null
          id?: string
          organization_id?: string | null
          payload?: Json | null
          platform: string
          processed_at?: string | null
          processing_status?: string | null
          received_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          headers?: Json | null
          id?: string
          organization_id?: string | null
          payload?: Json | null
          platform?: string
          processed_at?: string | null
          processing_status?: string | null
          received_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      backfill_monitoring: {
        Row: {
          completion_percentage: number | null
          hours_remaining_at_current_rate: number | null
          posts_per_minute: number | null
          processed: number | null
          processed_last_day: number | null
          processed_last_hour: number | null
          status: string | null
          unprocessed: number | null
        }
        Relationships: []
      }
      bluesky_trending_topics: {
        Row: {
          "1h": number | null
          "24h": number | null
          "6h": number | null
          calculated_at: string | null
          sentiment_avg: number | null
          status: string | null
          topic: string | null
          velocity: number | null
        }
        Relationships: []
      }
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
      mv_group_sentiment_daily: {
        Row: {
          article_count: number | null
          avg_sentiment: number | null
          categories: string[] | null
          date: string | null
          group_name: string | null
          sources: string[] | null
        }
        Relationships: []
      }
      mv_unified_trends: {
        Row: {
          combined_sentiment: number | null
          combined_velocity: number | null
          entity_type: string | null
          is_trending: boolean | null
          last_updated: string | null
          news_mentions: number | null
          news_sentiment: number | null
          news_topic: string | null
          news_trending: boolean | null
          news_velocity: number | null
          row_id: number | null
          social_mentions: number | null
          social_sentiment: number | null
          social_topic: string | null
          social_trending: boolean | null
          social_velocity: number | null
          topic: string | null
          total_mentions: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      archive_old_data: {
        Args: never
        Returns: {
          articles_archived: number
          bluesky_archived: number
        }[]
      }
      calculate_bluesky_trend_velocity: {
        Args: { topic_name: string }
        Returns: number
      }
      calculate_cross_source_score: {
        Args: {
          bluesky_count: number
          google_count: number
          reddit_count: number
          rss_count: number
        }
        Returns: number
      }
      calculate_next_run:
        | { Args: { cron_schedule: string }; Returns: string }
        | { Args: { cron_expr: string; from_time?: string }; Returns: string }
      calculate_sentiment_trend: {
        Args: { current_sentiment: number; previous_sentiment: number }
        Returns: string
      }
      calculate_topic_baselines: { Args: never; Returns: number }
      calculate_topic_velocity: {
        Args: {
          daily_count: number
          hourly_count: number
          six_hour_count: number
          topic_name: string
        }
        Returns: number
      }
      calculate_trend_velocity_v2: {
        Args: { mentions_1h: number; mentions_24h: number; mentions_6h: number }
        Returns: number
      }
      cleanup_old_cache: { Args: never; Returns: number }
      count_keyword_mentions: {
        Args: { search_keyword: string; time_window?: unknown }
        Returns: {
          bluesky_count: number
          news_count: number
          rss_count: number
          total_count: number
        }[]
      }
      count_posts_with_topic: {
        Args: { time_window?: unknown; topic_name: string }
        Returns: number
      }
      deduplicate_topic_name: { Args: { topic_name: string }; Returns: string }
      detect_velocity_anomalies: {
        Args: { lookback_hours?: number; z_threshold?: number }
        Returns: {
          avg_velocity: number
          current_velocity: number
          entity_type: string
          is_anomaly: boolean
          std_velocity: number
          topic: string
          z_score: number
        }[]
      }
      discover_trending_keywords: {
        Args: { min_frequency?: number; time_window?: unknown }
        Returns: {
          frequency: number
          keyword: string
          source_type: string
        }[]
      }
      get_backfill_progress: {
        Args: never
        Returns: {
          completion_percentage: number
          estimated_hours_remaining: number
          posts_per_second: number
          processed_items: number
          status: string
          task_name: string
          total_items: number
        }[]
      }
      get_briefing_stats: { Args: { target_date?: string }; Returns: Json }
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
      get_export_data: {
        Args: {
          p_end_date?: string
          p_export_type: string
          p_filters?: Json
          p_start_date?: string
        }
        Returns: Json
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
      get_system_health_metrics: { Args: never; Returns: Json }
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
      increment_cache_hit: {
        Args: { content_hash_param: string }
        Returns: undefined
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
      log_job_failure: {
        Args: {
          p_context?: Json
          p_error_message: string
          p_error_stack?: string
          p_function_name: string
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
      refresh_analytics_views: { Args: never; Returns: undefined }
      refresh_daily_group_sentiment: { Args: never; Returns: undefined }
      refresh_daily_metrics_summary: { Args: never; Returns: undefined }
      refresh_materialized_view: {
        Args: { view_name: string }
        Returns: undefined
      }
      refresh_unified_trends: { Args: never; Returns: undefined }
      reset_circuit_breaker: { Args: { job_id: string }; Returns: undefined }
      resolve_job_failure: {
        Args: { p_failure_id: string }
        Returns: undefined
      }
      update_bluesky_trends: {
        Args: never
        Returns: {
          mentions_24h: number
          topic_is_trending: boolean
          topic_name: string
          topic_velocity: number
        }[]
      }
      update_bluesky_trends_optimized: {
        Args: { batch_limit?: number }
        Returns: {
          mentions_24h: number
          topic_is_trending: boolean
          topic_name: string
          topic_velocity: number
        }[]
      }
      update_job_after_execution: {
        Args: {
          p_duration_ms: number
          p_error?: string
          p_job_id: string
          p_status: string
        }
        Returns: undefined
      }
      update_processing_checkpoint: {
        Args: {
          p_checkpoint_data?: Json
          p_function_name: string
          p_last_processed_id?: string
          p_records_processed?: number
        }
        Returns: undefined
      }
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
