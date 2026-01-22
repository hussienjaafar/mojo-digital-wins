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
      account_lockouts: {
        Row: {
          created_at: string
          failed_attempts: number
          id: string
          is_active: boolean
          locked_at: string
          reason: string
          unlock_at: string
          unlocked_at: string | null
          unlocked_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          id?: string
          is_active?: boolean
          locked_at?: string
          reason?: string
          unlock_at: string
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          id?: string
          is_active?: boolean
          locked_at?: string
          reason?: string
          unlock_at?: string
          unlocked_at?: string | null
          unlocked_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      actblue_backfill_chunks: {
        Row: {
          attempt_count: number | null
          chunk_index: number
          completed_at: string | null
          created_at: string | null
          end_date: string
          error_message: string | null
          id: string
          inserted_rows: number | null
          job_id: string
          max_attempts: number | null
          next_retry_at: string | null
          organization_id: string
          processed_rows: number | null
          skipped_rows: number | null
          start_date: string
          started_at: string | null
          status: string | null
          updated_at: string | null
          updated_rows: number | null
        }
        Insert: {
          attempt_count?: number | null
          chunk_index: number
          completed_at?: string | null
          created_at?: string | null
          end_date: string
          error_message?: string | null
          id?: string
          inserted_rows?: number | null
          job_id: string
          max_attempts?: number | null
          next_retry_at?: string | null
          organization_id: string
          processed_rows?: number | null
          skipped_rows?: number | null
          start_date: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          updated_rows?: number | null
        }
        Update: {
          attempt_count?: number | null
          chunk_index?: number
          completed_at?: string | null
          created_at?: string | null
          end_date?: string
          error_message?: string | null
          id?: string
          inserted_rows?: number | null
          job_id?: string
          max_attempts?: number | null
          next_retry_at?: string | null
          organization_id?: string
          processed_rows?: number | null
          skipped_rows?: number | null
          start_date?: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          updated_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "actblue_backfill_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actblue_backfill_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "actblue_backfill_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      actblue_transactions: {
        Row: {
          ab_test_name: string | null
          ab_test_variation: string | null
          addr1: string | null
          amount: number
          card_type: string | null
          city: string | null
          click_id: string | null
          committee_name: string | null
          contribution_form: string | null
          country: string | null
          created_at: string | null
          custom_fields: Json | null
          donor_email: string | null
          donor_name: string | null
          double_down: boolean | null
          employer: string | null
          entity_id: string | null
          fbclid: string | null
          fec_id: string | null
          fee: number | null
          first_name: string | null
          id: string
          is_express: boolean | null
          is_mobile: boolean | null
          is_recurring: boolean | null
          last_name: string | null
          lineitem_id: number | null
          net_amount: number | null
          next_charge_date: string | null
          occupation: string | null
          order_number: string | null
          organization_id: string
          payment_method: string | null
          phone: string | null
          phone_hash: string | null
          receipt_id: string | null
          recurring_duration: number | null
          recurring_period: string | null
          recurring_state: string | null
          recurring_upsell_shown: boolean | null
          recurring_upsell_succeeded: boolean | null
          refcode: string | null
          refcode_custom: string | null
          refcode2: string | null
          smart_boost_amount: number | null
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
          card_type?: string | null
          city?: string | null
          click_id?: string | null
          committee_name?: string | null
          contribution_form?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          donor_email?: string | null
          donor_name?: string | null
          double_down?: boolean | null
          employer?: string | null
          entity_id?: string | null
          fbclid?: string | null
          fec_id?: string | null
          fee?: number | null
          first_name?: string | null
          id?: string
          is_express?: boolean | null
          is_mobile?: boolean | null
          is_recurring?: boolean | null
          last_name?: string | null
          lineitem_id?: number | null
          net_amount?: number | null
          next_charge_date?: string | null
          occupation?: string | null
          order_number?: string | null
          organization_id: string
          payment_method?: string | null
          phone?: string | null
          phone_hash?: string | null
          receipt_id?: string | null
          recurring_duration?: number | null
          recurring_period?: string | null
          recurring_state?: string | null
          recurring_upsell_shown?: boolean | null
          recurring_upsell_succeeded?: boolean | null
          refcode?: string | null
          refcode_custom?: string | null
          refcode2?: string | null
          smart_boost_amount?: number | null
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
          card_type?: string | null
          city?: string | null
          click_id?: string | null
          committee_name?: string | null
          contribution_form?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          donor_email?: string | null
          donor_name?: string | null
          double_down?: boolean | null
          employer?: string | null
          entity_id?: string | null
          fbclid?: string | null
          fec_id?: string | null
          fee?: number | null
          first_name?: string | null
          id?: string
          is_express?: boolean | null
          is_mobile?: boolean | null
          is_recurring?: boolean | null
          last_name?: string | null
          lineitem_id?: number | null
          net_amount?: number | null
          next_charge_date?: string | null
          occupation?: string | null
          order_number?: string | null
          organization_id?: string
          payment_method?: string | null
          phone?: string | null
          phone_hash?: string | null
          receipt_id?: string | null
          recurring_duration?: number | null
          recurring_period?: string | null
          recurring_state?: string | null
          recurring_upsell_shown?: boolean | null
          recurring_upsell_succeeded?: boolean | null
          refcode?: string | null
          refcode_custom?: string | null
          refcode2?: string | null
          smart_boost_amount?: number | null
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
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      action_generator_runs: {
        Row: {
          actions_created: number | null
          ai_generated_count: number | null
          alerts_processed: number | null
          created_at: string | null
          error_count: number | null
          errors: Json | null
          finished_at: string | null
          id: string
          last_error: string | null
          metadata: Json | null
          organization_id: string | null
          skipped_count: number | null
          started_at: string
          template_generated_count: number | null
        }
        Insert: {
          actions_created?: number | null
          ai_generated_count?: number | null
          alerts_processed?: number | null
          created_at?: string | null
          error_count?: number | null
          errors?: Json | null
          finished_at?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json | null
          organization_id?: string | null
          skipped_count?: number | null
          started_at?: string
          template_generated_count?: number | null
        }
        Update: {
          actions_created?: number | null
          ai_generated_count?: number | null
          alerts_processed?: number | null
          created_at?: string | null
          error_count?: number | null
          errors?: Json | null
          finished_at?: string | null
          id?: string
          last_error?: string | null
          metadata?: Json | null
          organization_id?: string | null
          skipped_count?: number | null
          started_at?: string
          template_generated_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "action_generator_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_generator_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "action_generator_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          {
            foreignKeyName: "admin_activity_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "admin_activity_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          {
            foreignKeyName: "admin_invite_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
      article_dedupe_registry: {
        Row: {
          article_id: string | null
          canonical_url: string | null
          content_hash: string
          first_seen_at: string | null
          id: string
          published_date: string | null
          source_id: string | null
          source_type: string
          title_snippet: string | null
        }
        Insert: {
          article_id?: string | null
          canonical_url?: string | null
          content_hash: string
          first_seen_at?: string | null
          id?: string
          published_date?: string | null
          source_id?: string | null
          source_type: string
          title_snippet?: string | null
        }
        Update: {
          article_id?: string | null
          canonical_url?: string | null
          content_hash?: string
          first_seen_at?: string | null
          id?: string
          published_date?: string | null
          source_id?: string | null
          source_type?: string
          title_snippet?: string | null
        }
        Relationships: []
      }
      articles: {
        Row: {
          affected_groups: string[] | null
          affected_organizations: string[] | null
          ai_confidence_score: number | null
          ai_summary: string | null
          canonical_url: string | null
          category: string | null
          content: string | null
          content_hash: string | null
          created_at: string | null
          dedupe_key: string | null
          description: string | null
          duplicate_of: string | null
          extracted_hashtags: string[] | null
          extracted_topics: Json | null
          geographic_scope: string | null
          hash_signature: string | null
          id: string
          image_url: string | null
          is_duplicate: boolean | null
          last_processing_error: string | null
          last_processing_error_at: string | null
          political_leaning: string | null
          processing_state: string | null
          processing_status: string | null
          published_date: string
          relevance_category: string | null
          retry_count: number | null
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
          canonical_url?: string | null
          category?: string | null
          content?: string | null
          content_hash?: string | null
          created_at?: string | null
          dedupe_key?: string | null
          description?: string | null
          duplicate_of?: string | null
          extracted_hashtags?: string[] | null
          extracted_topics?: Json | null
          geographic_scope?: string | null
          hash_signature?: string | null
          id?: string
          image_url?: string | null
          is_duplicate?: boolean | null
          last_processing_error?: string | null
          last_processing_error_at?: string | null
          political_leaning?: string | null
          processing_state?: string | null
          processing_status?: string | null
          published_date: string
          relevance_category?: string | null
          retry_count?: number | null
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
          canonical_url?: string | null
          category?: string | null
          content?: string | null
          content_hash?: string | null
          created_at?: string | null
          dedupe_key?: string | null
          description?: string | null
          duplicate_of?: string | null
          extracted_hashtags?: string[] | null
          extracted_topics?: Json | null
          geographic_scope?: string | null
          hash_signature?: string | null
          id?: string
          image_url?: string | null
          is_duplicate?: boolean | null
          last_processing_error?: string | null
          last_processing_error_at?: string | null
          political_leaning?: string | null
          processing_state?: string | null
          processing_status?: string | null
          published_date?: string
          relevance_category?: string | null
          retry_count?: number | null
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
      attributed_donations: {
        Row: {
          ad_id: string | null
          amount: number
          attributed_platform: string
          attribution_confidence: number
          attribution_method: string
          campaign_id: string | null
          created_at: string
          creative_id: string | null
          donor_email: string | null
          id: string
          metadata: Json | null
          organization_id: string
          refcode: string | null
          rule_id: string | null
          transaction_date: string
          transaction_id: string
          updated_at: string
        }
        Insert: {
          ad_id?: string | null
          amount: number
          attributed_platform: string
          attribution_confidence?: number
          attribution_method: string
          campaign_id?: string | null
          created_at?: string
          creative_id?: string | null
          donor_email?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          refcode?: string | null
          rule_id?: string | null
          transaction_date: string
          transaction_id: string
          updated_at?: string
        }
        Update: {
          ad_id?: string | null
          amount?: number
          attributed_platform?: string
          attribution_confidence?: number
          attribution_method?: string
          campaign_id?: string | null
          created_at?: string
          creative_id?: string | null
          donor_email?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          refcode?: string | null
          rule_id?: string | null
          transaction_date?: string
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attributed_donations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributed_donations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "attributed_donations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "attributed_donations_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "refcode_attribution_rules"
            referencedColumns: ["id"]
          },
        ]
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
      attribution_matcher_runs: {
        Row: {
          created_at: string | null
          dry_run: boolean | null
          errors: Json | null
          finished_at: string | null
          id: string
          matched_revenue: number | null
          matches_deterministic: number | null
          matches_heuristic_fuzzy: number | null
          matches_heuristic_partial: number | null
          matches_heuristic_pattern: number | null
          metadata: Json | null
          organization_id: string | null
          skipped_deterministic_protected: number | null
          skipped_existing: number | null
          started_at: string
          total_matches: number | null
          unmatched_count: number | null
          unmatched_revenue: number | null
        }
        Insert: {
          created_at?: string | null
          dry_run?: boolean | null
          errors?: Json | null
          finished_at?: string | null
          id?: string
          matched_revenue?: number | null
          matches_deterministic?: number | null
          matches_heuristic_fuzzy?: number | null
          matches_heuristic_partial?: number | null
          matches_heuristic_pattern?: number | null
          metadata?: Json | null
          organization_id?: string | null
          skipped_deterministic_protected?: number | null
          skipped_existing?: number | null
          started_at?: string
          total_matches?: number | null
          unmatched_count?: number | null
          unmatched_revenue?: number | null
        }
        Update: {
          created_at?: string | null
          dry_run?: boolean | null
          errors?: Json | null
          finished_at?: string | null
          id?: string
          matched_revenue?: number | null
          matches_deterministic?: number | null
          matches_heuristic_fuzzy?: number | null
          matches_heuristic_partial?: number | null
          matches_heuristic_pattern?: number | null
          metadata?: Json | null
          organization_id?: string | null
          skipped_deterministic_protected?: number | null
          skipped_existing?: number | null
          started_at?: string
          total_matches?: number | null
          unmatched_count?: number | null
          unmatched_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attribution_matcher_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_matcher_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "attribution_matcher_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      attribution_model_log: {
        Row: {
          attribution_method: string | null
          attribution_model_version: string | null
          attribution_type: string | null
          calculated_at: string | null
          channels: Json | null
          created_at: string | null
          id: string
          is_deterministic: boolean | null
          organization_id: string
          transaction_id: string
        }
        Insert: {
          attribution_method?: string | null
          attribution_model_version?: string | null
          attribution_type?: string | null
          calculated_at?: string | null
          channels?: Json | null
          created_at?: string | null
          id?: string
          is_deterministic?: boolean | null
          organization_id: string
          transaction_id: string
        }
        Update: {
          attribution_method?: string | null
          attribution_model_version?: string | null
          attribution_type?: string | null
          calculated_at?: string | null
          channels?: Json | null
          created_at?: string | null
          id?: string
          is_deterministic?: boolean | null
          organization_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attribution_model_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_model_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "attribution_model_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      attribution_runs: {
        Row: {
          by_method: Json | null
          by_platform: Json | null
          errors: Json | null
          finished_at: string | null
          id: string
          organization_id: string | null
          run_type: string
          started_at: string
          status: string
          transactions_attributed: number | null
          transactions_processed: number | null
        }
        Insert: {
          by_method?: Json | null
          by_platform?: Json | null
          errors?: Json | null
          finished_at?: string | null
          id?: string
          organization_id?: string | null
          run_type: string
          started_at?: string
          status?: string
          transactions_attributed?: number | null
          transactions_processed?: number | null
        }
        Update: {
          by_method?: Json | null
          by_platform?: Json | null
          errors?: Json | null
          finished_at?: string | null
          id?: string
          organization_id?: string | null
          run_type?: string
          started_at?: string
          status?: string
          transactions_attributed?: number | null
          transactions_processed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attribution_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attribution_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "attribution_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      attribution_touchpoints: {
        Row: {
          ad_id: string | null
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
          ad_id?: string | null
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
          ad_id?: string | null
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
          {
            foreignKeyName: "attribution_touchpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "attribution_touchpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
      campaign_analytics: {
        Row: {
          campaign_id: string
          campaign_type: string | null
          click_rate: number | null
          clicks: number | null
          conversion_rate: number | null
          conversions: number | null
          created_at: string | null
          id: string
          open_rate: number | null
          opens: number | null
          organization_id: string
          revenue: number | null
          sends: number | null
          updated_at: string | null
        }
        Insert: {
          campaign_id: string
          campaign_type?: string | null
          click_rate?: number | null
          clicks?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          id?: string
          open_rate?: number | null
          opens?: number | null
          organization_id: string
          revenue?: number | null
          sends?: number | null
          updated_at?: string | null
        }
        Update: {
          campaign_id?: string
          campaign_type?: string | null
          click_rate?: number | null
          clicks?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string | null
          id?: string
          open_rate?: number | null
          opens?: number | null
          organization_id?: string
          revenue?: number | null
          sends?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_campaign_analytics_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaign_analytics_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fk_campaign_analytics_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      campaign_attribution: {
        Row: {
          attributed_revenue: number | null
          attributed_transactions: number | null
          attribution_type: string | null
          created_at: string | null
          id: string
          is_auto_matched: boolean | null
          is_deterministic: boolean | null
          last_matched_at: string | null
          match_confidence: number | null
          match_reason: string | null
          meta_campaign_id: string | null
          organization_id: string
          refcode: string | null
          switchboard_campaign_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          attributed_revenue?: number | null
          attributed_transactions?: number | null
          attribution_type?: string | null
          created_at?: string | null
          id?: string
          is_auto_matched?: boolean | null
          is_deterministic?: boolean | null
          last_matched_at?: string | null
          match_confidence?: number | null
          match_reason?: string | null
          meta_campaign_id?: string | null
          organization_id: string
          refcode?: string | null
          switchboard_campaign_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          attributed_revenue?: number | null
          attributed_transactions?: number | null
          attribution_type?: string | null
          created_at?: string | null
          id?: string
          is_auto_matched?: boolean | null
          is_deterministic?: boolean | null
          last_matched_at?: string | null
          match_confidence?: number | null
          match_reason?: string | null
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
          {
            foreignKeyName: "campaign_attribution_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "campaign_attribution_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      campaign_topic_extractions: {
        Row: {
          campaign_id: string
          campaign_type: string
          extracted_at: string | null
          extracted_topics: string[] | null
          id: string
          organization_id: string | null
          policy_domains: string[] | null
        }
        Insert: {
          campaign_id: string
          campaign_type: string
          extracted_at?: string | null
          extracted_topics?: string[] | null
          id?: string
          organization_id?: string | null
          policy_domains?: string[] | null
        }
        Update: {
          campaign_id?: string
          campaign_type?: string
          extracted_at?: string | null
          extracted_topics?: string[] | null
          id?: string
          organization_id?: string | null
          policy_domains?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_topic_extractions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_topic_extractions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "campaign_topic_extractions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      client_api_credentials: {
        Row: {
          created_at: string | null
          credential_mask: Json | null
          credential_version: number | null
          encrypted_credentials: Json
          id: string
          is_active: boolean | null
          last_meta_sync_at: string | null
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          last_test_error: string | null
          last_test_status: string | null
          last_tested_at: string | null
          latest_meta_data_date: string | null
          meta_sync_priority: string | null
          organization_id: string
          platform: string
          rate_limit_backoff_until: string | null
          refresh_status: string | null
          rotated_at: string | null
          rotated_by: string | null
          sync_error_count: number | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credential_mask?: Json | null
          credential_version?: number | null
          encrypted_credentials: Json
          id?: string
          is_active?: boolean | null
          last_meta_sync_at?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_test_error?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          latest_meta_data_date?: string | null
          meta_sync_priority?: string | null
          organization_id: string
          platform: string
          rate_limit_backoff_until?: string | null
          refresh_status?: string | null
          rotated_at?: string | null
          rotated_by?: string | null
          sync_error_count?: number | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credential_mask?: Json | null
          credential_version?: number | null
          encrypted_credentials?: Json
          id?: string
          is_active?: boolean | null
          last_meta_sync_at?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_status?: string | null
          last_test_error?: string | null
          last_test_status?: string | null
          last_tested_at?: string | null
          latest_meta_data_date?: string | null
          meta_sync_priority?: string | null
          organization_id?: string
          platform?: string
          rate_limit_backoff_until?: string | null
          refresh_status?: string | null
          rotated_at?: string | null
          rotated_by?: string | null
          sync_error_count?: number | null
          token_expires_at?: string | null
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
          {
            foreignKeyName: "client_api_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "client_api_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          trend_event_id: string | null
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
          trend_event_id?: string | null
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
          trend_event_id?: string | null
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
            foreignKeyName: "client_entity_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "client_entity_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "client_entity_alerts_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "label_quality_flags"
            referencedColumns: ["trend_id"]
          },
          {
            foreignKeyName: "client_entity_alerts_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_entity_alerts_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_events_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_entity_alerts_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_quality_flags"
            referencedColumns: ["trend_id"]
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
          {
            foreignKeyName: "client_onboarding_status_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "client_onboarding_status_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      client_organizations: {
        Row: {
          bonus_reason: string | null
          bonus_seats: number
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          max_concurrent_sessions: number
          mfa_grace_period_days: number | null
          mfa_required: boolean | null
          name: string
          org_timezone: string | null
          primary_contact_email: string | null
          seat_limit: number
          slug: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          bonus_reason?: string | null
          bonus_seats?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_concurrent_sessions?: number
          mfa_grace_period_days?: number | null
          mfa_required?: boolean | null
          name: string
          org_timezone?: string | null
          primary_contact_email?: string | null
          seat_limit?: number
          slug: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          bonus_reason?: string | null
          bonus_seats?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_concurrent_sessions?: number
          mfa_grace_period_days?: number | null
          mfa_required?: boolean | null
          name?: string
          org_timezone?: string | null
          primary_contact_email?: string | null
          seat_limit?: number
          slug?: string
          timezone?: string | null
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
          mask_pii: boolean | null
          organization_id: string
          role: string | null
          status: Database["public"]["Enums"]["user_status"]
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id: string
          last_login_at?: string | null
          mask_pii?: boolean | null
          organization_id: string
          role?: string | null
          status?: Database["public"]["Enums"]["user_status"]
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          last_login_at?: string | null
          mask_pii?: boolean | null
          organization_id?: string
          role?: string | null
          status?: Database["public"]["Enums"]["user_status"]
        }
        Relationships: [
          {
            foreignKeyName: "client_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "client_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      consent_records: {
        Row: {
          consent_type: string
          consent_version: string
          created_at: string
          granted: boolean
          granted_at: string | null
          id: string
          ip_address: unknown
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_type: string
          consent_version?: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          ip_address?: unknown
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_type?: string
          consent_version?: string
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          id?: string
          ip_address?: unknown
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "contact_submissions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
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
          {
            foreignKeyName: "creative_performance_learnings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "creative_performance_learnings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      cron_config: {
        Row: {
          created_at: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "daily_aggregated_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "daily_aggregated_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
      data_deletion_requests: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          deleted_tables: Json | null
          error_message: string | null
          id: string
          processed_at: string | null
          reason: string | null
          requested_at: string
          scheduled_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_tables?: Json | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          scheduled_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          deleted_tables?: Json | null
          error_message?: string | null
          id?: string
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          scheduled_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      data_export_logs: {
        Row: {
          created_at: string | null
          export_type: string
          filters_applied: Json | null
          id: string
          ip_address: string | null
          organization_id: string | null
          record_count: number | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          export_type: string
          filters_applied?: Json | null
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          record_count?: number | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          export_type?: string
          filters_applied?: Json | null
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          record_count?: number | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_export_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "data_export_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          download_expires_at: string | null
          download_url: string | null
          error_message: string | null
          format: string
          id: string
          processed_at: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          download_expires_at?: string | null
          download_url?: string | null
          error_message?: string | null
          format?: string
          id?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          download_expires_at?: string | null
          download_url?: string | null
          error_message?: string | null
          format?: string
          id?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      data_freshness: {
        Row: {
          created_at: string | null
          data_lag_hours: number | null
          freshness_sla_hours: number
          id: string
          is_within_sla: boolean | null
          last_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          latest_data_timestamp: string | null
          organization_id: string | null
          records_synced: number | null
          scope: string
          sla_breach_count: number | null
          source: string
          sync_duration_ms: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_lag_hours?: number | null
          freshness_sla_hours?: number
          id?: string
          is_within_sla?: boolean | null
          last_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          latest_data_timestamp?: string | null
          organization_id?: string | null
          records_synced?: number | null
          scope?: string
          sla_breach_count?: number | null
          source: string
          sync_duration_ms?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_lag_hours?: number | null
          freshness_sla_hours?: number
          id?: string
          is_within_sla?: boolean | null
          last_error?: string | null
          last_sync_status?: string | null
          last_synced_at?: string | null
          latest_data_timestamp?: string | null
          organization_id?: string | null
          records_synced?: number | null
          scope?: string
          sla_breach_count?: number | null
          source?: string
          sync_duration_ms?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_freshness_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_freshness_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "data_freshness_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
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
          {
            foreignKeyName: "data_freshness_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "data_freshness_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      data_retention_policies: {
        Row: {
          archive_before_delete: boolean
          created_at: string
          id: string
          is_active: boolean
          last_cleanup_at: string | null
          next_cleanup_at: string | null
          retention_days: number
          table_name: string
          updated_at: string
        }
        Insert: {
          archive_before_delete?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          last_cleanup_at?: string | null
          next_cleanup_at?: string | null
          retention_days?: number
          table_name: string
          updated_at?: string
        }
        Update: {
          archive_before_delete?: boolean
          created_at?: string
          id?: string
          is_active?: boolean
          last_cleanup_at?: string | null
          next_cleanup_at?: string | null
          retention_days?: number
          table_name?: string
          updated_at?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "donor_demographics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "donor_demographics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      donor_first_donation: {
        Row: {
          created_at: string
          donor_key: string
          first_amount: number | null
          first_donation_at: string
          first_refcode: string | null
          id: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          donor_key: string
          first_amount?: number | null
          first_donation_at: string
          first_refcode?: string | null
          id?: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          donor_key?: string
          first_amount?: number | null
          first_donation_at?: string
          first_refcode?: string | null
          id?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "donor_first_donation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donor_first_donation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "donor_first_donation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      donor_identity_links: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          donor_email: string | null
          email_hash: string | null
          id: string
          organization_id: string
          phone_hash: string | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          donor_email?: string | null
          email_hash?: string | null
          id?: string
          organization_id: string
          phone_hash?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          donor_email?: string | null
          email_hash?: string | null
          id?: string
          organization_id?: string
          phone_hash?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donor_identity_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donor_identity_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "donor_identity_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      donor_journeys: {
        Row: {
          amount: number | null
          campaign_id: string | null
          created_at: string | null
          donor_key: string
          event_type: string
          id: string
          metadata: Json | null
          net_amount: number | null
          occurred_at: string
          organization_id: string
          refcode: string | null
          source: string | null
          transaction_id: string | null
        }
        Insert: {
          amount?: number | null
          campaign_id?: string | null
          created_at?: string | null
          donor_key: string
          event_type: string
          id?: string
          metadata?: Json | null
          net_amount?: number | null
          occurred_at: string
          organization_id: string
          refcode?: string | null
          source?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number | null
          campaign_id?: string | null
          created_at?: string | null
          donor_key?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          net_amount?: number | null
          occurred_at?: string
          organization_id?: string
          refcode?: string | null
          source?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donor_journeys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donor_journeys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "donor_journeys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      donor_ltv_predictions: {
        Row: {
          calculated_at: string
          churn_risk: number | null
          churn_risk_label: string | null
          confidence_score: number | null
          created_at: string | null
          donor_key: string
          frequency: number | null
          id: string
          model_version: string | null
          monetary_avg: number | null
          monetary_total: number | null
          organization_id: string
          predicted_ltv_180: number | null
          predicted_ltv_30: number | null
          predicted_ltv_365: number | null
          predicted_ltv_90: number | null
          recency_days: number | null
          rfm_score: number | null
          segment: string | null
          updated_at: string | null
        }
        Insert: {
          calculated_at?: string
          churn_risk?: number | null
          churn_risk_label?: string | null
          confidence_score?: number | null
          created_at?: string | null
          donor_key: string
          frequency?: number | null
          id?: string
          model_version?: string | null
          monetary_avg?: number | null
          monetary_total?: number | null
          organization_id: string
          predicted_ltv_180?: number | null
          predicted_ltv_30?: number | null
          predicted_ltv_365?: number | null
          predicted_ltv_90?: number | null
          recency_days?: number | null
          rfm_score?: number | null
          segment?: string | null
          updated_at?: string | null
        }
        Update: {
          calculated_at?: string
          churn_risk?: number | null
          churn_risk_label?: string | null
          confidence_score?: number | null
          created_at?: string | null
          donor_key?: string
          frequency?: number | null
          id?: string
          model_version?: string | null
          monetary_avg?: number | null
          monetary_total?: number | null
          organization_id?: string
          predicted_ltv_180?: number | null
          predicted_ltv_30?: number | null
          predicted_ltv_365?: number | null
          predicted_ltv_90?: number | null
          recency_days?: number | null
          rfm_score?: number | null
          segment?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donor_ltv_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donor_ltv_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "donor_ltv_predictions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
            foreignKeyName: "email_report_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "email_report_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          {
            foreignKeyName: "email_report_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "email_report_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          context_keywords: string[] | null
          created_at: string | null
          created_by: string | null
          disambiguation_hint: string | null
          entity_name: string
          entity_type: string
          geo_focus: string[] | null
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
          context_keywords?: string[] | null
          created_at?: string | null
          created_by?: string | null
          disambiguation_hint?: string | null
          entity_name: string
          entity_type: string
          geo_focus?: string[] | null
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
          context_keywords?: string[] | null
          created_at?: string | null
          created_by?: string | null
          disambiguation_hint?: string | null
          entity_name?: string
          entity_type?: string
          geo_focus?: string[] | null
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
          {
            foreignKeyName: "entity_watchlist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "entity_watchlist_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          {
            foreignKeyName: "event_impact_correlations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "event_impact_correlations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
      freshness_sla_config: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          source: string
          sync_interval_minutes: number
          target_freshness_hours: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          source: string
          sync_interval_minutes: number
          target_freshness_hours: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          source?: string
          sync_interval_minutes?: number
          target_freshness_hours?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      fundraising_opportunities: {
        Row: {
          assigned_to: string | null
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
          notes: string | null
          opportunity_score: number
          opportunity_type: string | null
          org_relevance_reasons: string[] | null
          org_relevance_score: number | null
          organization_id: string
          sample_sources: Json | null
          similar_past_events: number | null
          status: string | null
          time_sensitivity: number | null
          trend_window_start: string | null
          updated_at: string
          velocity: number | null
        }
        Insert: {
          assigned_to?: string | null
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
          notes?: string | null
          opportunity_score: number
          opportunity_type?: string | null
          org_relevance_reasons?: string[] | null
          org_relevance_score?: number | null
          organization_id: string
          sample_sources?: Json | null
          similar_past_events?: number | null
          status?: string | null
          time_sensitivity?: number | null
          trend_window_start?: string | null
          updated_at?: string
          velocity?: number | null
        }
        Update: {
          assigned_to?: string | null
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
          notes?: string | null
          opportunity_score?: number
          opportunity_type?: string | null
          org_relevance_reasons?: string[] | null
          org_relevance_score?: number | null
          organization_id?: string
          sample_sources?: Json | null
          similar_past_events?: number | null
          status?: string | null
          time_sensitivity?: number | null
          trend_window_start?: string | null
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
          {
            foreignKeyName: "fundraising_opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "fundraising_opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          {
            foreignKeyName: "generated_campaign_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "generated_campaign_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          canonical_url: string | null
          content_hash: string | null
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
          canonical_url?: string | null
          content_hash?: string | null
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
          canonical_url?: string | null
          content_hash?: string | null
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
      google_news_sources: {
        Row: {
          backoff_until: string | null
          consecutive_errors: number | null
          created_at: string | null
          deactivated_at: string | null
          deactivation_reason: string | null
          expected_cadence_mins: number | null
          health_status: string | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_failure_at: string | null
          last_fetched_at: string | null
          last_success_at: string | null
          name: string
          success_count: number | null
          tags: string[] | null
          tier: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          backoff_until?: string | null
          consecutive_errors?: number | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivation_reason?: string | null
          expected_cadence_mins?: number | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_failure_at?: string | null
          last_fetched_at?: string | null
          last_success_at?: string | null
          name: string
          success_count?: number | null
          tags?: string[] | null
          tier?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          backoff_until?: string | null
          consecutive_errors?: number | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivation_reason?: string | null
          expected_cadence_mins?: number | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_failure_at?: string | null
          last_fetched_at?: string | null
          last_success_at?: string | null
          name?: string
          success_count?: number | null
          tags?: string[] | null
          tier?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
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
      intelligence_actions: {
        Row: {
          action_status: string
          action_type: string
          alert_id: string | null
          audience_id: string | null
          copy_text: string | null
          copy_variant: string | null
          created_at: string | null
          entity_name: string | null
          id: string
          meta_adset_id: string | null
          meta_campaign_id: string | null
          meta_creative_id: string | null
          metadata: Json | null
          organization_id: string
          sent_at: string | null
          sms_message_id: string | null
          suggested_action_id: string | null
          trend_event_id: string | null
        }
        Insert: {
          action_status?: string
          action_type: string
          alert_id?: string | null
          audience_id?: string | null
          copy_text?: string | null
          copy_variant?: string | null
          created_at?: string | null
          entity_name?: string | null
          id?: string
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_creative_id?: string | null
          metadata?: Json | null
          organization_id: string
          sent_at?: string | null
          sms_message_id?: string | null
          suggested_action_id?: string | null
          trend_event_id?: string | null
        }
        Update: {
          action_status?: string
          action_type?: string
          alert_id?: string | null
          audience_id?: string | null
          copy_text?: string | null
          copy_variant?: string | null
          created_at?: string | null
          entity_name?: string | null
          id?: string
          meta_adset_id?: string | null
          meta_campaign_id?: string | null
          meta_creative_id?: string | null
          metadata?: Json | null
          organization_id?: string
          sent_at?: string | null
          sms_message_id?: string | null
          suggested_action_id?: string | null
          trend_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "intelligence_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      invitation_audit_logs: {
        Row: {
          created_at: string
          email: string | null
          error_message: string | null
          event_type: string
          id: string
          invitation_id: string | null
          invitation_type: string | null
          metadata: Json | null
          organization_id: string | null
          source: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          invitation_id?: string | null
          invitation_type?: string | null
          metadata?: Json | null
          organization_id?: string | null
          source?: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          invitation_id?: string | null
          invitation_type?: string | null
          metadata?: Json | null
          organization_id?: string | null
          source?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_audit_logs_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "user_invitations"
            referencedColumns: ["id"]
          },
        ]
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
      learning_signals: {
        Row: {
          created_at: string | null
          id: string
          last_calculated_at: string | null
          metadata: Json | null
          pattern_key: string
          sample_count: number | null
          signal_type: string
          weight_adjustment: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_calculated_at?: string | null
          metadata?: Json | null
          pattern_key: string
          sample_count?: number | null
          signal_type: string
          weight_adjustment?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_calculated_at?: string | null
          metadata?: Json | null
          pattern_key?: string
          sample_count?: number | null
          signal_type?: string
          weight_adjustment?: number | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          created_at: string
          email: string
          failure_reason: string | null
          id: string
          ip_address: unknown
          success: boolean
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          created_at?: string
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          created_at?: string
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          success?: boolean
          user_agent?: string | null
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
          {
            foreignKeyName: "magic_moment_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "magic_moment_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          ingestion_run_id: string | null
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
          ingestion_run_id?: string | null
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
          ingestion_run_id?: string | null
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
          {
            foreignKeyName: "meta_ad_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_ad_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      meta_ad_metrics_daily: {
        Row: {
          ad_account_id: string
          ad_id: string
          ad_name: string | null
          adset_id: string | null
          campaign_id: string
          clicks: number | null
          conversion_ranking: string | null
          conversion_value: number | null
          conversions: number | null
          cost_per_result: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          creative_id: string | null
          ctr: number | null
          date: string
          engagement_ranking: string | null
          frequency: number | null
          id: string
          impressions: number | null
          link_clicks: number | null
          link_ctr: number | null
          meta_roas: number | null
          organization_id: string
          quality_ranking: string | null
          reach: number | null
          spend: number | null
          synced_at: string | null
        }
        Insert: {
          ad_account_id: string
          ad_id: string
          ad_name?: string | null
          adset_id?: string | null
          campaign_id: string
          clicks?: number | null
          conversion_ranking?: string | null
          conversion_value?: number | null
          conversions?: number | null
          cost_per_result?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          creative_id?: string | null
          ctr?: number | null
          date: string
          engagement_ranking?: string | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          link_clicks?: number | null
          link_ctr?: number | null
          meta_roas?: number | null
          organization_id: string
          quality_ranking?: string | null
          reach?: number | null
          spend?: number | null
          synced_at?: string | null
        }
        Update: {
          ad_account_id?: string
          ad_id?: string
          ad_name?: string | null
          adset_id?: string | null
          campaign_id?: string
          clicks?: number | null
          conversion_ranking?: string | null
          conversion_value?: number | null
          conversions?: number | null
          cost_per_result?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          creative_id?: string | null
          ctr?: number | null
          date?: string
          engagement_ranking?: string | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          link_clicks?: number | null
          link_ctr?: number | null
          meta_roas?: number | null
          organization_id?: string
          quality_ranking?: string | null
          reach?: number | null
          spend?: number | null
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_metrics_daily_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_metrics_daily_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_ad_metrics_daily_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          {
            foreignKeyName: "meta_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      meta_capi_config: {
        Row: {
          actblue_integration_enabled: boolean | null
          actblue_owns_donation_complete: boolean | null
          avg_match_score: number | null
          consecutive_failures: number | null
          created_at: string
          donation_event_name: string | null
          events_failed: number
          events_sent: number
          hash_address: boolean | null
          hash_email: boolean | null
          hash_name: boolean | null
          hash_phone: boolean | null
          id: string
          is_enabled: boolean
          last_error: string | null
          last_error_message: string | null
          last_event_at: string | null
          last_event_sent_at: string | null
          last_send_at: string | null
          last_send_status: string | null
          last_success_at: string | null
          organization_id: string
          pixel_id: string
          privacy_mode: string
          recurring_event_name: string | null
          test_event_code: string | null
          total_events_failed: number | null
          total_events_sent: number | null
          updated_at: string
        }
        Insert: {
          actblue_integration_enabled?: boolean | null
          actblue_owns_donation_complete?: boolean | null
          avg_match_score?: number | null
          consecutive_failures?: number | null
          created_at?: string
          donation_event_name?: string | null
          events_failed?: number
          events_sent?: number
          hash_address?: boolean | null
          hash_email?: boolean | null
          hash_name?: boolean | null
          hash_phone?: boolean | null
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_error_message?: string | null
          last_event_at?: string | null
          last_event_sent_at?: string | null
          last_send_at?: string | null
          last_send_status?: string | null
          last_success_at?: string | null
          organization_id: string
          pixel_id: string
          privacy_mode?: string
          recurring_event_name?: string | null
          test_event_code?: string | null
          total_events_failed?: number | null
          total_events_sent?: number | null
          updated_at?: string
        }
        Update: {
          actblue_integration_enabled?: boolean | null
          actblue_owns_donation_complete?: boolean | null
          avg_match_score?: number | null
          consecutive_failures?: number | null
          created_at?: string
          donation_event_name?: string | null
          events_failed?: number
          events_sent?: number
          hash_address?: boolean | null
          hash_email?: boolean | null
          hash_name?: boolean | null
          hash_phone?: boolean | null
          id?: string
          is_enabled?: boolean
          last_error?: string | null
          last_error_message?: string | null
          last_event_at?: string | null
          last_event_sent_at?: string | null
          last_send_at?: string | null
          last_send_status?: string | null
          last_success_at?: string | null
          organization_id?: string
          pixel_id?: string
          privacy_mode?: string
          recurring_event_name?: string | null
          test_event_code?: string | null
          total_events_failed?: number | null
          total_events_sent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_capi_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_capi_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_capi_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      meta_conversion_events: {
        Row: {
          action_source: string | null
          ad_id: string | null
          ad_set_id: string | null
          campaign_id: string | null
          created_at: string | null
          custom_data: Json | null
          dedupe_key: string | null
          delivered_at: string | null
          event_id: string
          event_name: string
          event_source_url: string | null
          event_time: number
          external_id: string | null
          fbc: string | null
          fbp: string | null
          id: string
          is_enrichment_only: boolean
          last_error: string | null
          match_quality: string | null
          match_score: number | null
          max_attempts: number | null
          meta_response: Json | null
          next_retry_at: string | null
          organization_id: string
          pixel_id: string
          refcode: string | null
          retry_count: number | null
          source_id: string | null
          source_type: string | null
          status: string
          trend_event_id: string | null
          updated_at: string | null
          user_data_hashed: Json | null
          user_id: string | null
        }
        Insert: {
          action_source?: string | null
          ad_id?: string | null
          ad_set_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          custom_data?: Json | null
          dedupe_key?: string | null
          delivered_at?: string | null
          event_id: string
          event_name: string
          event_source_url?: string | null
          event_time: number
          external_id?: string | null
          fbc?: string | null
          fbp?: string | null
          id?: string
          is_enrichment_only?: boolean
          last_error?: string | null
          match_quality?: string | null
          match_score?: number | null
          max_attempts?: number | null
          meta_response?: Json | null
          next_retry_at?: string | null
          organization_id: string
          pixel_id: string
          refcode?: string | null
          retry_count?: number | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          trend_event_id?: string | null
          updated_at?: string | null
          user_data_hashed?: Json | null
          user_id?: string | null
        }
        Update: {
          action_source?: string | null
          ad_id?: string | null
          ad_set_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          custom_data?: Json | null
          dedupe_key?: string | null
          delivered_at?: string | null
          event_id?: string
          event_name?: string
          event_source_url?: string | null
          event_time?: number
          external_id?: string | null
          fbc?: string | null
          fbp?: string | null
          id?: string
          is_enrichment_only?: boolean
          last_error?: string | null
          match_quality?: string | null
          match_score?: number | null
          max_attempts?: number | null
          meta_response?: Json | null
          next_retry_at?: string | null
          organization_id?: string
          pixel_id?: string
          refcode?: string | null
          retry_count?: number | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          trend_event_id?: string | null
          updated_at?: string | null
          user_data_hashed?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_conversion_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_conversion_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_conversion_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      meta_conversion_retry_queue: {
        Row: {
          attempt_count: number
          created_at: string
          custom_data: Json | null
          event_id: string
          event_name: string
          event_source_url: string | null
          event_time: string
          id: string
          last_error: string | null
          max_attempts: number
          next_retry_at: string
          organization_id: string
          pixel_id: string | null
          status: string
          updated_at: string
          user_data: Json | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          custom_data?: Json | null
          event_id: string
          event_name: string
          event_source_url?: string | null
          event_time?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string
          organization_id: string
          pixel_id?: string | null
          status?: string
          updated_at?: string
          user_data?: Json | null
        }
        Update: {
          attempt_count?: number
          created_at?: string
          custom_data?: Json | null
          event_id?: string
          event_name?: string
          event_source_url?: string | null
          event_time?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string
          organization_id?: string
          pixel_id?: string | null
          status?: string
          updated_at?: string
          user_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_conversion_retry_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_conversion_retry_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_conversion_retry_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          color_palette: string[] | null
          comments: number | null
          conversion_rate_ranking: string | null
          conversion_value: number | null
          conversions: number | null
          created_at: string | null
          created_date: string | null
          creative_id: string | null
          creative_type: string | null
          ctr: number | null
          description: string | null
          destination_url: string | null
          detected_text: string | null
          effectiveness_score: number | null
          emotional_appeal: string | null
          engagement_rate_ranking: string | null
          extracted_refcode: string | null
          first_seen_at: string | null
          frequency: number | null
          has_faces: boolean | null
          headline: string | null
          id: string
          image_height: number | null
          image_width: number | null
          impressions: number | null
          key_quotes: Json | null
          key_themes: string[] | null
          link_clicks: number | null
          link_ctr: number | null
          media_source_url: string | null
          media_type: string | null
          meta_image_hash: string | null
          meta_video_id: string | null
          organization_id: string
          performance_tier: string | null
          post_engagement: number | null
          primary_text: string | null
          quality_ranking: string | null
          reactions_like: number | null
          reactions_love: number | null
          reactions_other: number | null
          reactions_total: number | null
          refcode_source: string | null
          roas: number | null
          sentiment_label: string | null
          sentiment_score: number | null
          shares: number | null
          spend: number | null
          thumbnail_url: string | null
          tone: string | null
          topic: string | null
          total_conversion_value: number | null
          total_conversions: number | null
          total_impressions: number | null
          total_spend: number | null
          transcript_confidence: number | null
          transcription_status: string | null
          updated_at: string | null
          urgency_level: string | null
          verbal_themes: string[] | null
          video_avg_watch_time_seconds: number | null
          video_duration_seconds: number | null
          video_p100: number | null
          video_p25: number | null
          video_p50: number | null
          video_p75: number | null
          video_plays: number | null
          video_thruplay: number | null
          video_url: string | null
          visual_analysis: Json | null
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
          color_palette?: string[] | null
          comments?: number | null
          conversion_rate_ranking?: string | null
          conversion_value?: number | null
          conversions?: number | null
          created_at?: string | null
          created_date?: string | null
          creative_id?: string | null
          creative_type?: string | null
          ctr?: number | null
          description?: string | null
          destination_url?: string | null
          detected_text?: string | null
          effectiveness_score?: number | null
          emotional_appeal?: string | null
          engagement_rate_ranking?: string | null
          extracted_refcode?: string | null
          first_seen_at?: string | null
          frequency?: number | null
          has_faces?: boolean | null
          headline?: string | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          impressions?: number | null
          key_quotes?: Json | null
          key_themes?: string[] | null
          link_clicks?: number | null
          link_ctr?: number | null
          media_source_url?: string | null
          media_type?: string | null
          meta_image_hash?: string | null
          meta_video_id?: string | null
          organization_id: string
          performance_tier?: string | null
          post_engagement?: number | null
          primary_text?: string | null
          quality_ranking?: string | null
          reactions_like?: number | null
          reactions_love?: number | null
          reactions_other?: number | null
          reactions_total?: number | null
          refcode_source?: string | null
          roas?: number | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          shares?: number | null
          spend?: number | null
          thumbnail_url?: string | null
          tone?: string | null
          topic?: string | null
          total_conversion_value?: number | null
          total_conversions?: number | null
          total_impressions?: number | null
          total_spend?: number | null
          transcript_confidence?: number | null
          transcription_status?: string | null
          updated_at?: string | null
          urgency_level?: string | null
          verbal_themes?: string[] | null
          video_avg_watch_time_seconds?: number | null
          video_duration_seconds?: number | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          video_plays?: number | null
          video_thruplay?: number | null
          video_url?: string | null
          visual_analysis?: Json | null
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
          color_palette?: string[] | null
          comments?: number | null
          conversion_rate_ranking?: string | null
          conversion_value?: number | null
          conversions?: number | null
          created_at?: string | null
          created_date?: string | null
          creative_id?: string | null
          creative_type?: string | null
          ctr?: number | null
          description?: string | null
          destination_url?: string | null
          detected_text?: string | null
          effectiveness_score?: number | null
          emotional_appeal?: string | null
          engagement_rate_ranking?: string | null
          extracted_refcode?: string | null
          first_seen_at?: string | null
          frequency?: number | null
          has_faces?: boolean | null
          headline?: string | null
          id?: string
          image_height?: number | null
          image_width?: number | null
          impressions?: number | null
          key_quotes?: Json | null
          key_themes?: string[] | null
          link_clicks?: number | null
          link_ctr?: number | null
          media_source_url?: string | null
          media_type?: string | null
          meta_image_hash?: string | null
          meta_video_id?: string | null
          organization_id?: string
          performance_tier?: string | null
          post_engagement?: number | null
          primary_text?: string | null
          quality_ranking?: string | null
          reactions_like?: number | null
          reactions_love?: number | null
          reactions_other?: number | null
          reactions_total?: number | null
          refcode_source?: string | null
          roas?: number | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          shares?: number | null
          spend?: number | null
          thumbnail_url?: string | null
          tone?: string | null
          topic?: string | null
          total_conversion_value?: number | null
          total_conversions?: number | null
          total_impressions?: number | null
          total_spend?: number | null
          transcript_confidence?: number | null
          transcription_status?: string | null
          updated_at?: string | null
          urgency_level?: string | null
          verbal_themes?: string[] | null
          video_avg_watch_time_seconds?: number | null
          video_duration_seconds?: number | null
          video_p100?: number | null
          video_p25?: number | null
          video_p50?: number | null
          video_p75?: number | null
          video_plays?: number | null
          video_thruplay?: number | null
          video_url?: string | null
          visual_analysis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_creative_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_creative_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_creative_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      meta_creative_variations: {
        Row: {
          ad_id: string
          asset_hash: string | null
          asset_index: number
          asset_text: string | null
          asset_type: string
          clicks: number | null
          conversion_value: number | null
          conversions: number | null
          cpa: number | null
          created_at: string | null
          creative_insight_id: string | null
          ctr: number | null
          id: string
          impressions: number | null
          inline_link_clicks: number | null
          is_estimated: boolean | null
          link_clicks: number | null
          link_ctr: number | null
          organization_id: string
          performance_rank: number | null
          purchases: number | null
          ranking_method: string | null
          reach: number | null
          roas: number | null
          spend: number | null
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          ad_id: string
          asset_hash?: string | null
          asset_index?: number
          asset_text?: string | null
          asset_type: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string | null
          creative_insight_id?: string | null
          ctr?: number | null
          id?: string
          impressions?: number | null
          inline_link_clicks?: number | null
          is_estimated?: boolean | null
          link_clicks?: number | null
          link_ctr?: number | null
          organization_id: string
          performance_rank?: number | null
          purchases?: number | null
          ranking_method?: string | null
          reach?: number | null
          roas?: number | null
          spend?: number | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_id?: string
          asset_hash?: string | null
          asset_index?: number
          asset_text?: string | null
          asset_type?: string
          clicks?: number | null
          conversion_value?: number | null
          conversions?: number | null
          cpa?: number | null
          created_at?: string | null
          creative_insight_id?: string | null
          ctr?: number | null
          id?: string
          impressions?: number | null
          inline_link_clicks?: number | null
          is_estimated?: boolean | null
          link_clicks?: number | null
          link_ctr?: number | null
          organization_id?: string
          performance_rank?: number | null
          purchases?: number | null
          ranking_method?: string | null
          reach?: number | null
          roas?: number | null
          spend?: number | null
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_creative_variations_creative_insight_id_fkey"
            columns: ["creative_insight_id"]
            isOneToOne: false
            referencedRelation: "meta_creative_insights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_creative_variations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_creative_variations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "meta_creative_variations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      meta_sync_config: {
        Row: {
          created_at: string | null
          date_range_days: number
          description: string | null
          id: string
          interval_minutes: number
          tier: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_range_days?: number
          description?: string | null
          id?: string
          interval_minutes: number
          tier: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_range_days?: number
          description?: string | null
          id?: string
          interval_minutes?: number
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      mfa_enrollment_log: {
        Row: {
          action: string
          id: string
          ip_address: string | null
          method: string
          performed_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          id?: string
          ip_address?: string | null
          method: string
          performed_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          id?: string
          ip_address?: string | null
          method?: string
          performed_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      occupation_categories: {
        Row: {
          category: string
          created_at: string | null
          id: number
          pattern: string
          sort_order: number | null
          subcategory: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: number
          pattern: string
          sort_order?: number | null
          subcategory?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: number
          pattern?: string
          sort_order?: number | null
          subcategory?: string | null
        }
        Relationships: []
      }
      opportunity_detector_runs: {
        Row: {
          created_at: string | null
          created_count: number | null
          error_count: number | null
          errors: Json | null
          expired_count: number | null
          finished_at: string | null
          high_priority_count: number | null
          id: string
          low_priority_count: number | null
          medium_priority_count: number | null
          metadata: Json | null
          organization_id: string | null
          skipped_count: number | null
          started_at: string
          trends_processed: number | null
          updated_count: number | null
        }
        Insert: {
          created_at?: string | null
          created_count?: number | null
          error_count?: number | null
          errors?: Json | null
          expired_count?: number | null
          finished_at?: string | null
          high_priority_count?: number | null
          id?: string
          low_priority_count?: number | null
          medium_priority_count?: number | null
          metadata?: Json | null
          organization_id?: string | null
          skipped_count?: number | null
          started_at?: string
          trends_processed?: number | null
          updated_count?: number | null
        }
        Update: {
          created_at?: string | null
          created_count?: number | null
          error_count?: number | null
          errors?: Json | null
          expired_count?: number | null
          finished_at?: string | null
          high_priority_count?: number | null
          id?: string
          low_priority_count?: number | null
          medium_priority_count?: number | null
          metadata?: Json | null
          organization_id?: string | null
          skipped_count?: number | null
          started_at?: string
          trends_processed?: number | null
          updated_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_detector_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_detector_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "opportunity_detector_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      org_activity_log: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_name: string | null
          created_at: string | null
          details: Json | null
          id: string
          organization_id: string
          target_user_id: string | null
          target_user_name: string | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          organization_id: string
          target_user_id?: string | null
          target_user_name?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          organization_id?: string
          target_user_id?: string | null
          target_user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_activity_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      org_alert_preferences: {
        Row: {
          always_generate_safe_variant: boolean | null
          created_at: string | null
          digest_mode: string | null
          id: string
          max_alerts_per_day: number | null
          min_decision_score: number | null
          min_relevance_score: number | null
          min_urgency_score: number | null
          notify_channels: string[] | null
          organization_id: string
          quiet_hours: Json | null
          updated_at: string | null
        }
        Insert: {
          always_generate_safe_variant?: boolean | null
          created_at?: string | null
          digest_mode?: string | null
          id?: string
          max_alerts_per_day?: number | null
          min_decision_score?: number | null
          min_relevance_score?: number | null
          min_urgency_score?: number | null
          notify_channels?: string[] | null
          organization_id: string
          quiet_hours?: Json | null
          updated_at?: string | null
        }
        Update: {
          always_generate_safe_variant?: boolean | null
          created_at?: string | null
          digest_mode?: string | null
          id?: string
          max_alerts_per_day?: number | null
          min_decision_score?: number | null
          min_relevance_score?: number | null
          min_urgency_score?: number | null
          notify_channels?: string[] | null
          organization_id?: string
          quiet_hours?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_alert_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_alert_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_alert_preferences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      org_feedback_events: {
        Row: {
          copy_diff: string | null
          created_at: string | null
          edited_final_copy: string | null
          entity_name: string | null
          event_type: string
          id: string
          object_id: string
          object_type: string
          organization_id: string
          reason_code: string | null
          reason_detail: string | null
          relevance_score_at_time: number | null
          topic_tags: string[] | null
          urgency_score_at_time: number | null
          user_id: string | null
        }
        Insert: {
          copy_diff?: string | null
          created_at?: string | null
          edited_final_copy?: string | null
          entity_name?: string | null
          event_type: string
          id?: string
          object_id: string
          object_type: string
          organization_id: string
          reason_code?: string | null
          reason_detail?: string | null
          relevance_score_at_time?: number | null
          topic_tags?: string[] | null
          urgency_score_at_time?: number | null
          user_id?: string | null
        }
        Update: {
          copy_diff?: string | null
          created_at?: string | null
          edited_final_copy?: string | null
          entity_name?: string | null
          event_type?: string
          id?: string
          object_id?: string
          object_type?: string
          organization_id?: string
          reason_code?: string | null
          reason_detail?: string | null
          relevance_score_at_time?: number | null
          topic_tags?: string[] | null
          urgency_score_at_time?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_feedback_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_feedback_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_feedback_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      org_interest_entities: {
        Row: {
          created_at: string | null
          entity_name: string
          id: string
          organization_id: string
          reason: string | null
          rule_type: string
        }
        Insert: {
          created_at?: string | null
          entity_name: string
          id?: string
          organization_id: string
          reason?: string | null
          rule_type: string
        }
        Update: {
          created_at?: string | null
          entity_name?: string
          id?: string
          organization_id?: string
          reason?: string | null
          rule_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_interest_entities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_interest_entities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_interest_entities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      org_interest_model_runs: {
        Row: {
          created_at: string | null
          error_count: number | null
          errors: Json | null
          feedback_events_processed: number | null
          finished_at: string | null
          id: string
          metadata: Json | null
          orgs_processed: number | null
          started_at: string
          topics_updated: number | null
        }
        Insert: {
          created_at?: string | null
          error_count?: number | null
          errors?: Json | null
          feedback_events_processed?: number | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          orgs_processed?: number | null
          started_at?: string
          topics_updated?: number | null
        }
        Update: {
          created_at?: string | null
          error_count?: number | null
          errors?: Json | null
          feedback_events_processed?: number | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          orgs_processed?: number | null
          started_at?: string
          topics_updated?: number | null
        }
        Relationships: []
      }
      org_interest_topics: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          source: string | null
          topic: string
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id: string
          source?: string | null
          topic: string
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          source?: string | null
          topic?: string
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_interest_topics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_interest_topics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_interest_topics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      org_onboarding_state: {
        Row: {
          blocking_reason: string | null
          completed_steps: Json
          created_at: string
          created_by: string | null
          current_step: number
          id: string
          last_updated_at: string
          last_updated_by: string | null
          organization_id: string
          status: string
          step_data: Json | null
        }
        Insert: {
          blocking_reason?: string | null
          completed_steps?: Json
          created_at?: string
          created_by?: string | null
          current_step?: number
          id?: string
          last_updated_at?: string
          last_updated_by?: string | null
          organization_id: string
          status?: string
          step_data?: Json | null
        }
        Update: {
          blocking_reason?: string | null
          completed_steps?: Json
          created_at?: string
          created_by?: string | null
          current_step?: number
          id?: string
          last_updated_at?: string
          last_updated_by?: string | null
          organization_id?: string
          status?: string
          step_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "org_onboarding_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_onboarding_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_onboarding_state_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      org_topic_affinities: {
        Row: {
          affinity_score: number
          avg_performance: number | null
          best_performance: number | null
          created_at: string | null
          id: string
          last_used_at: string | null
          organization_id: string | null
          source: string | null
          times_used: number | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          affinity_score?: number
          avg_performance?: number | null
          best_performance?: number | null
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          organization_id?: string | null
          source?: string | null
          times_used?: number | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          affinity_score?: number
          avg_performance?: number | null
          best_performance?: number | null
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          organization_id?: string | null
          source?: string | null
          times_used?: number | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_topic_affinities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_topic_affinities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_topic_affinities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      org_trend_relevance_cache: {
        Row: {
          computed_at: string | null
          id: string
          is_new_opportunity: boolean | null
          is_proven_topic: boolean | null
          matched_domains: string[] | null
          matched_watchlist: string[] | null
          organization_id: string | null
          priority_bucket: string | null
          relevance_flags: string[] | null
          relevance_reasons: Json | null
          relevance_score: number
          trend_event_id: string | null
        }
        Insert: {
          computed_at?: string | null
          id?: string
          is_new_opportunity?: boolean | null
          is_proven_topic?: boolean | null
          matched_domains?: string[] | null
          matched_watchlist?: string[] | null
          organization_id?: string | null
          priority_bucket?: string | null
          relevance_flags?: string[] | null
          relevance_reasons?: Json | null
          relevance_score: number
          trend_event_id?: string | null
        }
        Update: {
          computed_at?: string | null
          id?: string
          is_new_opportunity?: boolean | null
          is_proven_topic?: boolean | null
          matched_domains?: string[] | null
          matched_watchlist?: string[] | null
          organization_id?: string | null
          priority_bucket?: string | null
          relevance_flags?: string[] | null
          relevance_reasons?: Json | null
          relevance_score?: number
          trend_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_trend_relevance_cache_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_trend_relevance_cache_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_trend_relevance_cache_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_trend_relevance_cache_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "label_quality_flags"
            referencedColumns: ["trend_id"]
          },
          {
            foreignKeyName: "org_trend_relevance_cache_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_trend_relevance_cache_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_events_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_trend_relevance_cache_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_quality_flags"
            referencedColumns: ["trend_id"]
          },
        ]
      }
      org_trend_scores: {
        Row: {
          computed_at: string | null
          expires_at: string | null
          explanation: Json | null
          id: string
          is_allowlisted: boolean | null
          is_blocked: boolean | null
          matched_entities: string[] | null
          matched_geographies: string[] | null
          matched_topics: string[] | null
          organization_id: string
          priority_bucket: string | null
          relevance_score: number
          trend_cluster_id: string | null
          trend_event_id: string | null
          trend_key: string
          urgency_score: number
        }
        Insert: {
          computed_at?: string | null
          expires_at?: string | null
          explanation?: Json | null
          id?: string
          is_allowlisted?: boolean | null
          is_blocked?: boolean | null
          matched_entities?: string[] | null
          matched_geographies?: string[] | null
          matched_topics?: string[] | null
          organization_id: string
          priority_bucket?: string | null
          relevance_score?: number
          trend_cluster_id?: string | null
          trend_event_id?: string | null
          trend_key: string
          urgency_score?: number
        }
        Update: {
          computed_at?: string | null
          expires_at?: string | null
          explanation?: Json | null
          id?: string
          is_allowlisted?: boolean | null
          is_blocked?: boolean | null
          matched_entities?: string[] | null
          matched_geographies?: string[] | null
          matched_topics?: string[] | null
          organization_id?: string
          priority_bucket?: string | null
          relevance_score?: number
          trend_cluster_id?: string | null
          trend_event_id?: string | null
          trend_key?: string
          urgency_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "org_trend_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_trend_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_trend_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_trend_scores_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "label_quality_flags"
            referencedColumns: ["trend_id"]
          },
          {
            foreignKeyName: "org_trend_scores_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_trend_scores_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_events_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_trend_scores_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_quality_flags"
            referencedColumns: ["trend_id"]
          },
        ]
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
          allies: string[] | null
          audiences: string[] | null
          channels_enabled: string[] | null
          created_at: string | null
          display_name: string | null
          embedding: string | null
          embedding_generated_at: string | null
          embedding_text: string | null
          focus_areas: string[] | null
          geographies: string[] | null
          id: string
          interest_topics: string[] | null
          key_issues: string[] | null
          mission_summary: string | null
          opponents: string[] | null
          org_type: string | null
          organization_id: string | null
          primary_goals: string[] | null
          priority_lanes: string[] | null
          related_orgs: string[] | null
          scraped_at: string | null
          sensitivity_redlines: Json | null
          stakeholders: string[] | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          ai_extracted_data?: Json | null
          allies?: string[] | null
          audiences?: string[] | null
          channels_enabled?: string[] | null
          created_at?: string | null
          display_name?: string | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_text?: string | null
          focus_areas?: string[] | null
          geographies?: string[] | null
          id?: string
          interest_topics?: string[] | null
          key_issues?: string[] | null
          mission_summary?: string | null
          opponents?: string[] | null
          org_type?: string | null
          organization_id?: string | null
          primary_goals?: string[] | null
          priority_lanes?: string[] | null
          related_orgs?: string[] | null
          scraped_at?: string | null
          sensitivity_redlines?: Json | null
          stakeholders?: string[] | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          ai_extracted_data?: Json | null
          allies?: string[] | null
          audiences?: string[] | null
          channels_enabled?: string[] | null
          created_at?: string | null
          display_name?: string | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_text?: string | null
          focus_areas?: string[] | null
          geographies?: string[] | null
          id?: string
          interest_topics?: string[] | null
          key_issues?: string[] | null
          mission_summary?: string | null
          opponents?: string[] | null
          org_type?: string | null
          organization_id?: string | null
          primary_goals?: string[] | null
          priority_lanes?: string[] | null
          related_orgs?: string[] | null
          scraped_at?: string | null
          sensitivity_redlines?: Json | null
          stakeholders?: string[] | null
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
          {
            foreignKeyName: "organization_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      organization_quotas: {
        Row: {
          created_at: string | null
          current_day_count: number | null
          current_hour_count: number | null
          day_reset_at: string | null
          hour_reset_at: string | null
          id: string
          is_unlimited: boolean | null
          max_per_day: number | null
          max_per_hour: number | null
          organization_id: string
          quota_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_day_count?: number | null
          current_hour_count?: number | null
          day_reset_at?: string | null
          hour_reset_at?: string | null
          id?: string
          is_unlimited?: boolean | null
          max_per_day?: number | null
          max_per_hour?: number | null
          organization_id: string
          quota_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_day_count?: number | null
          current_hour_count?: number | null
          day_reset_at?: string | null
          hour_reset_at?: string | null
          id?: string
          is_unlimited?: boolean | null
          max_per_day?: number | null
          max_per_hour?: number | null
          organization_id?: string
          quota_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_quotas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_quotas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "organization_quotas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      outcome_events: {
        Row: {
          action_id: string | null
          attributed: boolean | null
          attribution_confidence: number | null
          id: string
          meta_campaign_id: string | null
          meta_creative_id: string | null
          metadata: Json | null
          occurred_at: string
          organization_id: string
          outcome_count: number | null
          outcome_type: string
          outcome_value: number | null
          recorded_at: string | null
          sms_message_id: string | null
          transaction_id: string | null
        }
        Insert: {
          action_id?: string | null
          attributed?: boolean | null
          attribution_confidence?: number | null
          id?: string
          meta_campaign_id?: string | null
          meta_creative_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          organization_id: string
          outcome_count?: number | null
          outcome_type: string
          outcome_value?: number | null
          recorded_at?: string | null
          sms_message_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          action_id?: string | null
          attributed?: boolean | null
          attribution_confidence?: number | null
          id?: string
          meta_campaign_id?: string | null
          meta_creative_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          organization_id?: string
          outcome_count?: number | null
          outcome_type?: string
          outcome_value?: number | null
          recorded_at?: string | null
          sms_message_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outcome_events_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "action_outcome_summary"
            referencedColumns: ["action_id"]
          },
          {
            foreignKeyName: "outcome_events_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "intelligence_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "outcome_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      password_reset_requests: {
        Row: {
          email_hash: string
          id: string
          ip_address: unknown
          requested_at: string
          success: boolean | null
          user_agent: string | null
        }
        Insert: {
          email_hash: string
          id?: string
          ip_address?: unknown
          requested_at?: string
          success?: boolean | null
          user_agent?: string | null
        }
        Update: {
          email_hash?: string
          id?: string
          ip_address?: unknown
          requested_at?: string
          success?: boolean | null
          user_agent?: string | null
        }
        Relationships: []
      }
      pending_member_requests: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          notes: string | null
          organization_id: string
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          requested_by: string
          requested_role: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          notes?: string | null
          organization_id: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requested_by: string
          requested_role?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          notes?: string | null
          organization_id?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          requested_by?: string
          requested_role?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_member_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_member_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "pending_member_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      pipeline_deadman_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          actual_age_minutes: number | null
          alert_type: string
          consecutive_failures: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          job_name: string | null
          job_type: string
          message: string
          resolved_at: string | null
          severity: string
          sla_minutes: number | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_age_minutes?: number | null
          alert_type: string
          consecutive_failures?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          job_name?: string | null
          job_type: string
          message: string
          resolved_at?: string | null
          severity: string
          sla_minutes?: number | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          actual_age_minutes?: number | null
          alert_type?: string
          consecutive_failures?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          job_name?: string | null
          job_type?: string
          message?: string
          resolved_at?: string | null
          severity?: string
          sla_minutes?: number | null
        }
        Relationships: []
      }
      pipeline_health_snapshots: {
        Row: {
          actionable_alerts_24h: number | null
          actions_generated_24h: number | null
          ai_generated_count: number | null
          created_at: string | null
          generate_actions_count: number | null
          generate_actions_last_error: string | null
          generate_actions_last_run: string | null
          generate_actions_status: string
          id: string
          match_watchlist_alerts_created: number | null
          match_watchlist_last_error: string | null
          match_watchlist_last_run: string | null
          match_watchlist_status: string
          organization_id: string | null
          snapshot_at: string | null
          template_generated_count: number | null
        }
        Insert: {
          actionable_alerts_24h?: number | null
          actions_generated_24h?: number | null
          ai_generated_count?: number | null
          created_at?: string | null
          generate_actions_count?: number | null
          generate_actions_last_error?: string | null
          generate_actions_last_run?: string | null
          generate_actions_status?: string
          id?: string
          match_watchlist_alerts_created?: number | null
          match_watchlist_last_error?: string | null
          match_watchlist_last_run?: string | null
          match_watchlist_status?: string
          organization_id?: string | null
          snapshot_at?: string | null
          template_generated_count?: number | null
        }
        Update: {
          actionable_alerts_24h?: number | null
          actions_generated_24h?: number | null
          ai_generated_count?: number | null
          created_at?: string | null
          generate_actions_count?: number | null
          generate_actions_last_error?: string | null
          generate_actions_last_run?: string | null
          generate_actions_status?: string
          id?: string
          match_watchlist_alerts_created?: number | null
          match_watchlist_last_error?: string | null
          match_watchlist_last_run?: string | null
          match_watchlist_status?: string
          organization_id?: string | null
          snapshot_at?: string | null
          template_generated_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_health_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_health_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "pipeline_health_snapshots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      pipeline_heartbeat: {
        Row: {
          consecutive_failures: number | null
          created_at: string | null
          id: string
          is_critical: boolean | null
          job_name: string | null
          job_type: string
          last_duration_ms: number | null
          last_error: string | null
          last_failure_at: string | null
          last_started_at: string | null
          last_status: string | null
          last_success_at: string | null
          sla_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          consecutive_failures?: number | null
          created_at?: string | null
          id?: string
          is_critical?: boolean | null
          job_name?: string | null
          job_type: string
          last_duration_ms?: number | null
          last_error?: string | null
          last_failure_at?: string | null
          last_started_at?: string | null
          last_status?: string | null
          last_success_at?: string | null
          sla_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          consecutive_failures?: number | null
          created_at?: string | null
          id?: string
          is_critical?: boolean | null
          job_name?: string | null
          job_type?: string
          last_duration_ms?: number | null
          last_error?: string | null
          last_failure_at?: string | null
          last_started_at?: string | null
          last_status?: string | null
          last_success_at?: string | null
          sla_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pipeline_runs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          error_details: Json | null
          error_summary: string | null
          id: string
          idempotency_key: string | null
          job_name: string | null
          job_type: string
          records_created: number | null
          records_failed: number | null
          records_ingested: number | null
          records_processed: number | null
          started_at: string | null
          status: string | null
          triggered_by: string | null
          triggered_by_user: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_summary?: string | null
          id?: string
          idempotency_key?: string | null
          job_name?: string | null
          job_type: string
          records_created?: number | null
          records_failed?: number | null
          records_ingested?: number | null
          records_processed?: number | null
          started_at?: string | null
          status?: string | null
          triggered_by?: string | null
          triggered_by_user?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_details?: Json | null
          error_summary?: string | null
          id?: string
          idempotency_key?: string | null
          job_name?: string | null
          job_type?: string
          records_created?: number | null
          records_failed?: number | null
          records_ingested?: number | null
          records_processed?: number | null
          started_at?: string | null
          status?: string | null
          triggered_by?: string | null
          triggered_by_user?: string | null
        }
        Relationships: []
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
          {
            foreignKeyName: "polling_alert_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "polling_alert_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
      privacy_settings: {
        Row: {
          analytics_tracking: boolean
          created_at: string
          do_not_sell: boolean
          id: string
          marketing_emails: boolean
          product_updates: boolean
          third_party_sharing: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          analytics_tracking?: boolean
          created_at?: string
          do_not_sell?: boolean
          id?: string
          marketing_emails?: boolean
          product_updates?: boolean
          third_party_sharing?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          analytics_tracking?: boolean
          created_at?: string
          do_not_sell?: boolean
          id?: string
          marketing_emails?: boolean
          product_updates?: boolean
          third_party_sharing?: boolean
          updated_at?: string
          user_id?: string
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
          mfa_enabled_at: string | null
          mfa_method: string | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          session_revoked_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          last_sign_in_at?: string | null
          mfa_enabled_at?: string | null
          mfa_method?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          session_revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_sign_in_at?: string | null
          mfa_enabled_at?: string | null
          mfa_method?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          session_revoked_at?: string | null
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
      refcode_attribution_rules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_global: boolean
          match_type: string
          organization_id: string | null
          pattern: string
          platform: string
          priority: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          match_type?: string
          organization_id?: string | null
          pattern: string
          platform: string
          priority?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_global?: boolean
          match_type?: string
          organization_id?: string | null
          pattern?: string
          platform?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refcode_attribution_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refcode_attribution_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "refcode_attribution_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      refcode_mapping_history: {
        Row: {
          ad_id: string
          campaign_id: string | null
          created_at: string
          creative_id: string | null
          first_seen_at: string
          id: string
          is_active: boolean | null
          landing_page: string | null
          last_seen_at: string
          organization_id: string
          refcode: string
          updated_at: string
        }
        Insert: {
          ad_id: string
          campaign_id?: string | null
          created_at?: string
          creative_id?: string | null
          first_seen_at?: string
          id?: string
          is_active?: boolean | null
          landing_page?: string | null
          last_seen_at?: string
          organization_id: string
          refcode: string
          updated_at?: string
        }
        Update: {
          ad_id?: string
          campaign_id?: string | null
          created_at?: string
          creative_id?: string | null
          first_seen_at?: string
          id?: string
          is_active?: boolean | null
          landing_page?: string | null
          last_seen_at?: string
          organization_id?: string
          refcode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refcode_mapping_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refcode_mapping_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "refcode_mapping_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      refcode_mappings: {
        Row: {
          ad_id: string | null
          ad_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          click_id: string | null
          created_at: string | null
          creative_id: string | null
          creative_name: string | null
          fbclid: string | null
          id: string
          landing_page: string | null
          organization_id: string | null
          platform: string | null
          refcode: string
          sms_campaign_id: string | null
          updated_at: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          click_id?: string | null
          created_at?: string | null
          creative_id?: string | null
          creative_name?: string | null
          fbclid?: string | null
          id?: string
          landing_page?: string | null
          organization_id?: string | null
          platform?: string | null
          refcode: string
          sms_campaign_id?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          click_id?: string | null
          created_at?: string | null
          creative_id?: string | null
          creative_name?: string | null
          fbclid?: string | null
          id?: string
          landing_page?: string | null
          organization_id?: string | null
          platform?: string | null
          refcode?: string
          sms_campaign_id?: string | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refcode_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refcode_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "refcode_mappings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
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
          {
            foreignKeyName: "roi_analytics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "roi_analytics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      rss_sources: {
        Row: {
          backoff_until: string | null
          category: string
          consecutive_errors: number | null
          created_at: string | null
          deactivated_at: string | null
          deactivation_reason: string | null
          error_count: number | null
          expected_cadence_mins: number | null
          fetch_error: string | null
          fetch_frequency_minutes: number | null
          geographic_scope: string | null
          health_status: string | null
          id: string
          is_active: boolean | null
          last_error_at: string | null
          last_error_message: string | null
          last_fetch_status: string | null
          last_fetched_at: string | null
          last_success_at: string | null
          logo_url: string | null
          name: string
          policy_domains: string[] | null
          political_leaning: string | null
          source_type: string | null
          state_code: string | null
          success_count: number | null
          tags: string[] | null
          tier: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          backoff_until?: string | null
          category: string
          consecutive_errors?: number | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivation_reason?: string | null
          error_count?: number | null
          expected_cadence_mins?: number | null
          fetch_error?: string | null
          fetch_frequency_minutes?: number | null
          geographic_scope?: string | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_fetch_status?: string | null
          last_fetched_at?: string | null
          last_success_at?: string | null
          logo_url?: string | null
          name: string
          policy_domains?: string[] | null
          political_leaning?: string | null
          source_type?: string | null
          state_code?: string | null
          success_count?: number | null
          tags?: string[] | null
          tier?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          backoff_until?: string | null
          category?: string
          consecutive_errors?: number | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivation_reason?: string | null
          error_count?: number | null
          expected_cadence_mins?: number | null
          fetch_error?: string | null
          fetch_frequency_minutes?: number | null
          geographic_scope?: string | null
          health_status?: string | null
          id?: string
          is_active?: boolean | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_fetch_status?: string | null
          last_fetched_at?: string | null
          last_success_at?: string | null
          logo_url?: string | null
          name?: string
          policy_domains?: string[] | null
          political_leaning?: string | null
          source_type?: string | null
          state_code?: string | null
          success_count?: number | null
          tags?: string[] | null
          tier?: string | null
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
      seat_change_log: {
        Row: {
          change_type: string
          changed_by: string
          created_at: string | null
          id: string
          new_bonus: number | null
          new_limit: number | null
          old_bonus: number | null
          old_limit: number | null
          organization_id: string
          reason: string | null
        }
        Insert: {
          change_type: string
          changed_by: string
          created_at?: string | null
          id?: string
          new_bonus?: number | null
          new_limit?: number | null
          old_bonus?: number | null
          old_limit?: number | null
          organization_id: string
          reason?: string | null
        }
        Update: {
          change_type?: string
          changed_by?: string
          created_at?: string | null
          id?: string
          new_bonus?: number | null
          new_limit?: number | null
          old_bonus?: number | null
          old_limit?: number | null
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seat_change_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_change_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "seat_change_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      seat_requests: {
        Row: {
          admin_notes: string | null
          created_at: string | null
          current_seat_limit: number
          id: string
          organization_id: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          requested_by: string
          requested_seats: number
          status: string
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string | null
          current_seat_limit: number
          id?: string
          organization_id: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_by: string
          requested_seats: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string | null
          current_seat_limit?: number
          id?: string
          organization_id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_by?: string
          requested_seats?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seat_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "seat_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          {
            foreignKeyName: "send_time_optimizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "send_time_optimizations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
      session_revocation_log: {
        Row: {
          id: string
          reason: string | null
          revoked_at: string
          revoked_by: string
          sessions_terminated: number | null
          user_id: string
        }
        Insert: {
          id?: string
          reason?: string | null
          revoked_at?: string
          revoked_by: string
          sessions_terminated?: number | null
          user_id: string
        }
        Update: {
          id?: string
          reason?: string | null
          revoked_at?: string
          revoked_by?: string
          sessions_terminated?: number | null
          user_id?: string
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
          {
            foreignKeyName: "sms_campaign_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "sms_campaign_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      sms_campaigns: {
        Row: {
          actblue_refcode: string | null
          amount_raised: number | null
          analyzed_at: string | null
          call_to_action: string | null
          campaign_id: string
          campaign_name: string | null
          clicks: number | null
          conversions: number | null
          cost: number | null
          created_at: string | null
          destination_url: string | null
          extracted_refcode: string | null
          id: string
          key_themes: string[] | null
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
          tone: string | null
          topic: string | null
          topic_summary: string | null
          updated_at: string | null
          urgency_level: string | null
        }
        Insert: {
          actblue_refcode?: string | null
          amount_raised?: number | null
          analyzed_at?: string | null
          call_to_action?: string | null
          campaign_id: string
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cost?: number | null
          created_at?: string | null
          destination_url?: string | null
          extracted_refcode?: string | null
          id?: string
          key_themes?: string[] | null
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
          tone?: string | null
          topic?: string | null
          topic_summary?: string | null
          updated_at?: string | null
          urgency_level?: string | null
        }
        Update: {
          actblue_refcode?: string | null
          amount_raised?: number | null
          analyzed_at?: string | null
          call_to_action?: string | null
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cost?: number | null
          created_at?: string | null
          destination_url?: string | null
          extracted_refcode?: string | null
          id?: string
          key_themes?: string[] | null
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
          tone?: string | null
          topic?: string | null
          topic_summary?: string | null
          updated_at?: string | null
          urgency_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "sms_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          {
            foreignKeyName: "sms_creative_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "sms_creative_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      sms_events: {
        Row: {
          campaign_id: string | null
          campaign_name: string | null
          created_at: string | null
          error_code: string | null
          event_type: string
          id: string
          ingestion_run_id: string | null
          link_clicked: string | null
          message_id: string | null
          metadata: Json | null
          occurred_at: string
          organization_id: string
          phone_hash: string | null
          reply_intent: string | null
          reply_sentiment: string | null
          reply_text: string | null
          sentiment_analyzed: boolean | null
        }
        Insert: {
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string | null
          error_code?: string | null
          event_type: string
          id?: string
          ingestion_run_id?: string | null
          link_clicked?: string | null
          message_id?: string | null
          metadata?: Json | null
          occurred_at: string
          organization_id: string
          phone_hash?: string | null
          reply_intent?: string | null
          reply_sentiment?: string | null
          reply_text?: string | null
          sentiment_analyzed?: boolean | null
        }
        Update: {
          campaign_id?: string | null
          campaign_name?: string | null
          created_at?: string | null
          error_code?: string | null
          event_type?: string
          id?: string
          ingestion_run_id?: string | null
          link_clicked?: string | null
          message_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          organization_id?: string
          phone_hash?: string | null
          reply_intent?: string | null
          reply_sentiment?: string | null
          reply_text?: string | null
          sentiment_analyzed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "sms_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
      source_health_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          details: Json | null
          id: string
          is_resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          source_id: string
          source_name: string
          source_type: string
          tags: string[] | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          is_resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_id: string
          source_name: string
          source_type: string
          tags?: string[] | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          is_resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          source_id?: string
          source_name?: string
          source_type?: string
          tags?: string[] | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      source_tiers: {
        Row: {
          authority_weight: number | null
          category: string | null
          created_at: string | null
          domain: string
          id: string
          name: string | null
          tier: string
        }
        Insert: {
          authority_weight?: number | null
          category?: string | null
          created_at?: string | null
          domain: string
          id?: string
          name?: string | null
          tier: string
        }
        Update: {
          authority_weight?: number | null
          category?: string | null
          created_at?: string | null
          domain?: string
          id?: string
          name?: string | null
          tier?: string
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
            foreignKeyName: "submission_notes_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_notes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "contact_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_notes_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "contact_submissions_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      suggested_actions: {
        Row: {
          action_type: string
          alert_id: string | null
          audience_segment: string | null
          character_count: number | null
          compliance_checks: Json | null
          compliance_status: string | null
          confidence_score: number | null
          created_at: string | null
          decision_score: number | null
          dedupe_key: string | null
          edited_copy: string | null
          entity_name: string | null
          estimated_impact: string | null
          fit_score: number | null
          generation_method: string | null
          generation_rationale: Json | null
          historical_performance: Json | null
          id: string
          is_dismissed: boolean | null
          is_used: boolean | null
          opportunity_score: number | null
          org_relevance_reasons: string[] | null
          org_relevance_score: number | null
          organization_id: string | null
          original_copy: string | null
          risk_score: number | null
          status: string | null
          suggested_copy: string | null
          topic_relevance: number | null
          updated_at: string | null
          urgency_score: number | null
          used_at: string | null
          value_prop: string | null
          variant_group_id: string | null
          variant_type: string | null
          was_edited: boolean | null
          was_sent: boolean | null
        }
        Insert: {
          action_type: string
          alert_id?: string | null
          audience_segment?: string | null
          character_count?: number | null
          compliance_checks?: Json | null
          compliance_status?: string | null
          confidence_score?: number | null
          created_at?: string | null
          decision_score?: number | null
          dedupe_key?: string | null
          edited_copy?: string | null
          entity_name?: string | null
          estimated_impact?: string | null
          fit_score?: number | null
          generation_method?: string | null
          generation_rationale?: Json | null
          historical_performance?: Json | null
          id?: string
          is_dismissed?: boolean | null
          is_used?: boolean | null
          opportunity_score?: number | null
          org_relevance_reasons?: string[] | null
          org_relevance_score?: number | null
          organization_id?: string | null
          original_copy?: string | null
          risk_score?: number | null
          status?: string | null
          suggested_copy?: string | null
          topic_relevance?: number | null
          updated_at?: string | null
          urgency_score?: number | null
          used_at?: string | null
          value_prop?: string | null
          variant_group_id?: string | null
          variant_type?: string | null
          was_edited?: boolean | null
          was_sent?: boolean | null
        }
        Update: {
          action_type?: string
          alert_id?: string | null
          audience_segment?: string | null
          character_count?: number | null
          compliance_checks?: Json | null
          compliance_status?: string | null
          confidence_score?: number | null
          created_at?: string | null
          decision_score?: number | null
          dedupe_key?: string | null
          edited_copy?: string | null
          entity_name?: string | null
          estimated_impact?: string | null
          fit_score?: number | null
          generation_method?: string | null
          generation_rationale?: Json | null
          historical_performance?: Json | null
          id?: string
          is_dismissed?: boolean | null
          is_used?: boolean | null
          opportunity_score?: number | null
          org_relevance_reasons?: string[] | null
          org_relevance_score?: number | null
          organization_id?: string | null
          original_copy?: string | null
          risk_score?: number | null
          status?: string | null
          suggested_copy?: string | null
          topic_relevance?: number | null
          updated_at?: string | null
          urgency_score?: number | null
          used_at?: string | null
          value_prop?: string | null
          variant_group_id?: string | null
          variant_type?: string | null
          was_edited?: boolean | null
          was_sent?: boolean | null
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
          {
            foreignKeyName: "suggested_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "suggested_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      system_baselines: {
        Row: {
          baseline_value: number
          calculation_method: string | null
          created_at: string | null
          id: string
          last_calculated_at: string | null
          metric_name: string
          updated_at: string | null
        }
        Insert: {
          baseline_value?: number
          calculation_method?: string | null
          created_at?: string | null
          id?: string
          last_calculated_at?: string | null
          metric_name: string
          updated_at?: string | null
        }
        Update: {
          baseline_value?: number
          calculation_method?: string | null
          created_at?: string | null
          id?: string
          last_calculated_at?: string | null
          metric_name?: string
          updated_at?: string | null
        }
        Relationships: []
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
          attribution_method: string | null
          created_at: string | null
          donor_email: string | null
          first_touch_campaign: string | null
          first_touch_channel: string | null
          first_touch_weight: number | null
          id: string
          is_deterministic: boolean | null
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
          attribution_method?: string | null
          created_at?: string | null
          donor_email?: string | null
          first_touch_campaign?: string | null
          first_touch_channel?: string | null
          first_touch_weight?: number | null
          id?: string
          is_deterministic?: boolean | null
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
          attribution_method?: string | null
          created_at?: string | null
          donor_email?: string | null
          first_touch_campaign?: string | null
          first_touch_channel?: string | null
          first_touch_weight?: number | null
          id?: string
          is_deterministic?: boolean | null
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
          {
            foreignKeyName: "transaction_attribution_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "transaction_attribution_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      trend_action_outcomes: {
        Row: {
          action_taken_at: string
          action_type: string
          created_at: string
          id: string
          metadata: Json | null
          organization_id: string | null
          outcome_recorded_at: string | null
          outcome_type: string | null
          outcome_value: number | null
          trend_event_id: string | null
        }
        Insert: {
          action_taken_at?: string
          action_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          outcome_recorded_at?: string | null
          outcome_type?: string | null
          outcome_value?: number | null
          trend_event_id?: string | null
        }
        Update: {
          action_taken_at?: string
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          outcome_recorded_at?: string | null
          outcome_type?: string | null
          outcome_value?: number | null
          trend_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_action_outcomes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_action_outcomes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "trend_action_outcomes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "trend_action_outcomes_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "label_quality_flags"
            referencedColumns: ["trend_id"]
          },
          {
            foreignKeyName: "trend_action_outcomes_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_action_outcomes_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_events_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_action_outcomes_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_quality_flags"
            referencedColumns: ["trend_id"]
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
      trend_baselines: {
        Row: {
          avg_sentiment: number | null
          baseline_date: string
          created_at: string | null
          event_key: string
          hourly_average: number | null
          hourly_readings: number[] | null
          hourly_std_dev: number | null
          id: string
          is_stable: boolean | null
          max_hourly: number | null
          mentions_count: number | null
          min_hourly: number | null
          news_mentions: number | null
          relative_std_dev: number | null
          social_mentions: number | null
        }
        Insert: {
          avg_sentiment?: number | null
          baseline_date: string
          created_at?: string | null
          event_key: string
          hourly_average?: number | null
          hourly_readings?: number[] | null
          hourly_std_dev?: number | null
          id?: string
          is_stable?: boolean | null
          max_hourly?: number | null
          mentions_count?: number | null
          min_hourly?: number | null
          news_mentions?: number | null
          relative_std_dev?: number | null
          social_mentions?: number | null
        }
        Update: {
          avg_sentiment?: number | null
          baseline_date?: string
          created_at?: string | null
          event_key?: string
          hourly_average?: number | null
          hourly_readings?: number[] | null
          hourly_std_dev?: number | null
          id?: string
          is_stable?: boolean | null
          max_hourly?: number | null
          mentions_count?: number | null
          min_hourly?: number | null
          news_mentions?: number | null
          relative_std_dev?: number | null
          social_mentions?: number | null
        }
        Relationships: []
      }
      trend_campaign_correlations: {
        Row: {
          campaign_id: string
          campaign_performance: Json | null
          correlation_score: number
          created_at: string | null
          domain_overlap: string[] | null
          id: string
          organization_id: string | null
          outcome_label: string | null
          performance_vs_baseline: number | null
          time_delta_hours: number | null
          topic_overlap: string[] | null
          trend_event_id: string | null
        }
        Insert: {
          campaign_id: string
          campaign_performance?: Json | null
          correlation_score: number
          created_at?: string | null
          domain_overlap?: string[] | null
          id?: string
          organization_id?: string | null
          outcome_label?: string | null
          performance_vs_baseline?: number | null
          time_delta_hours?: number | null
          topic_overlap?: string[] | null
          trend_event_id?: string | null
        }
        Update: {
          campaign_id?: string
          campaign_performance?: Json | null
          correlation_score?: number
          created_at?: string | null
          domain_overlap?: string[] | null
          id?: string
          organization_id?: string | null
          outcome_label?: string | null
          performance_vs_baseline?: number | null
          time_delta_hours?: number | null
          topic_overlap?: string[] | null
          trend_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_campaign_correlations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_campaign_correlations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "trend_campaign_correlations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "trend_campaign_correlations_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "label_quality_flags"
            referencedColumns: ["trend_id"]
          },
          {
            foreignKeyName: "trend_campaign_correlations_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_campaign_correlations_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_events_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_campaign_correlations_trend_event_id_fkey"
            columns: ["trend_event_id"]
            isOneToOne: false
            referencedRelation: "trend_quality_flags"
            referencedColumns: ["trend_id"]
          },
        ]
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
      trend_detection_config: {
        Row: {
          baseline_min_deviation_pct: number | null
          baseline_window_days: number | null
          created_at: string | null
          evergreen_volume_override: number | null
          id: string
          is_global_default: boolean | null
          min_mentions_breakthrough: number | null
          min_mentions_to_trend: number | null
          min_source_count: number | null
          min_spike_ratio: number | null
          min_velocity_score: number | null
          organization_id: string | null
          source_weights: Json | null
          spike_window_hours: number | null
          suppress_evergreen: boolean | null
          trend_window_hours: number | null
          updated_at: string | null
        }
        Insert: {
          baseline_min_deviation_pct?: number | null
          baseline_window_days?: number | null
          created_at?: string | null
          evergreen_volume_override?: number | null
          id?: string
          is_global_default?: boolean | null
          min_mentions_breakthrough?: number | null
          min_mentions_to_trend?: number | null
          min_source_count?: number | null
          min_spike_ratio?: number | null
          min_velocity_score?: number | null
          organization_id?: string | null
          source_weights?: Json | null
          spike_window_hours?: number | null
          suppress_evergreen?: boolean | null
          trend_window_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          baseline_min_deviation_pct?: number | null
          baseline_window_days?: number | null
          created_at?: string | null
          evergreen_volume_override?: number | null
          id?: string
          is_global_default?: boolean | null
          min_mentions_breakthrough?: number | null
          min_mentions_to_trend?: number | null
          min_source_count?: number | null
          min_spike_ratio?: number | null
          min_velocity_score?: number | null
          organization_id?: string | null
          source_weights?: Json | null
          spike_window_hours?: number | null
          suppress_evergreen?: boolean | null
          trend_window_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_detection_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_detection_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "trend_detection_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      trend_events: {
        Row: {
          acceleration: number | null
          alias_variants: string[] | null
          baseline_30d: number | null
          baseline_7d: number | null
          baseline_std_dev: number | null
          baseline_updated_at: string | null
          burst_normalized_score: number | null
          burst_score: number | null
          canonical_label: string | null
          cluster_id: string | null
          co_occurrence_anomaly_score: number | null
          confidence_factors: Json | null
          confidence_score: number | null
          context_phrases: string[] | null
          context_summary: string | null
          context_terms: string[] | null
          corroboration_score: number | null
          created_at: string | null
          current_1h: number | null
          current_24h: number | null
          current_6h: number | null
          decision_score: number | null
          embedding: string | null
          embedding_generated_at: string | null
          embedding_text: string | null
          entity_type: string | null
          event_key: string
          event_title: string
          evergreen_penalty: number | null
          evidence_by_domain: Json | null
          evidence_count: number | null
          first_seen_at: string
          geo_level: string | null
          geographies: string[] | null
          has_tier12_corroboration: boolean | null
          id: string
          is_breaking: boolean | null
          is_event_phrase: boolean | null
          is_evergreen_detected: boolean | null
          is_tier3_only: boolean | null
          is_trending: boolean | null
          is_verified: boolean | null
          label_quality: string | null
          label_source: string | null
          last_seen_at: string
          legislation_mentioned: string[] | null
          news_source_count: number | null
          opportunity_tier: string | null
          organizations_mentioned: string[] | null
          peak_at: string | null
          poisson_surprise: number | null
          policy_domains: string[] | null
          politicians_mentioned: string[] | null
          priority_bucket: string | null
          rank_score: number | null
          recency_decay: number | null
          related_entities: string[] | null
          related_phrases: string[] | null
          related_topics: string[] | null
          semantic_cluster_id: string | null
          sentiment_label: string | null
          sentiment_score: number | null
          social_source_count: number | null
          source_count: number | null
          tier1_count: number | null
          tier2_count: number | null
          tier3_count: number | null
          top_headline: string | null
          trend_score: number | null
          trend_stage: string | null
          true_z_score: number | null
          updated_at: string | null
          velocity: number | null
          velocity_1h: number | null
          velocity_6h: number | null
          weighted_evidence_score: number | null
          z_score_velocity: number | null
        }
        Insert: {
          acceleration?: number | null
          alias_variants?: string[] | null
          baseline_30d?: number | null
          baseline_7d?: number | null
          baseline_std_dev?: number | null
          baseline_updated_at?: string | null
          burst_normalized_score?: number | null
          burst_score?: number | null
          canonical_label?: string | null
          cluster_id?: string | null
          co_occurrence_anomaly_score?: number | null
          confidence_factors?: Json | null
          confidence_score?: number | null
          context_phrases?: string[] | null
          context_summary?: string | null
          context_terms?: string[] | null
          corroboration_score?: number | null
          created_at?: string | null
          current_1h?: number | null
          current_24h?: number | null
          current_6h?: number | null
          decision_score?: number | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_text?: string | null
          entity_type?: string | null
          event_key: string
          event_title: string
          evergreen_penalty?: number | null
          evidence_by_domain?: Json | null
          evidence_count?: number | null
          first_seen_at?: string
          geo_level?: string | null
          geographies?: string[] | null
          has_tier12_corroboration?: boolean | null
          id?: string
          is_breaking?: boolean | null
          is_event_phrase?: boolean | null
          is_evergreen_detected?: boolean | null
          is_tier3_only?: boolean | null
          is_trending?: boolean | null
          is_verified?: boolean | null
          label_quality?: string | null
          label_source?: string | null
          last_seen_at?: string
          legislation_mentioned?: string[] | null
          news_source_count?: number | null
          opportunity_tier?: string | null
          organizations_mentioned?: string[] | null
          peak_at?: string | null
          poisson_surprise?: number | null
          policy_domains?: string[] | null
          politicians_mentioned?: string[] | null
          priority_bucket?: string | null
          rank_score?: number | null
          recency_decay?: number | null
          related_entities?: string[] | null
          related_phrases?: string[] | null
          related_topics?: string[] | null
          semantic_cluster_id?: string | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          social_source_count?: number | null
          source_count?: number | null
          tier1_count?: number | null
          tier2_count?: number | null
          tier3_count?: number | null
          top_headline?: string | null
          trend_score?: number | null
          trend_stage?: string | null
          true_z_score?: number | null
          updated_at?: string | null
          velocity?: number | null
          velocity_1h?: number | null
          velocity_6h?: number | null
          weighted_evidence_score?: number | null
          z_score_velocity?: number | null
        }
        Update: {
          acceleration?: number | null
          alias_variants?: string[] | null
          baseline_30d?: number | null
          baseline_7d?: number | null
          baseline_std_dev?: number | null
          baseline_updated_at?: string | null
          burst_normalized_score?: number | null
          burst_score?: number | null
          canonical_label?: string | null
          cluster_id?: string | null
          co_occurrence_anomaly_score?: number | null
          confidence_factors?: Json | null
          confidence_score?: number | null
          context_phrases?: string[] | null
          context_summary?: string | null
          context_terms?: string[] | null
          corroboration_score?: number | null
          created_at?: string | null
          current_1h?: number | null
          current_24h?: number | null
          current_6h?: number | null
          decision_score?: number | null
          embedding?: string | null
          embedding_generated_at?: string | null
          embedding_text?: string | null
          entity_type?: string | null
          event_key?: string
          event_title?: string
          evergreen_penalty?: number | null
          evidence_by_domain?: Json | null
          evidence_count?: number | null
          first_seen_at?: string
          geo_level?: string | null
          geographies?: string[] | null
          has_tier12_corroboration?: boolean | null
          id?: string
          is_breaking?: boolean | null
          is_event_phrase?: boolean | null
          is_evergreen_detected?: boolean | null
          is_tier3_only?: boolean | null
          is_trending?: boolean | null
          is_verified?: boolean | null
          label_quality?: string | null
          label_source?: string | null
          last_seen_at?: string
          legislation_mentioned?: string[] | null
          news_source_count?: number | null
          opportunity_tier?: string | null
          organizations_mentioned?: string[] | null
          peak_at?: string | null
          poisson_surprise?: number | null
          policy_domains?: string[] | null
          politicians_mentioned?: string[] | null
          priority_bucket?: string | null
          rank_score?: number | null
          recency_decay?: number | null
          related_entities?: string[] | null
          related_phrases?: string[] | null
          related_topics?: string[] | null
          semantic_cluster_id?: string | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          social_source_count?: number | null
          source_count?: number | null
          tier1_count?: number | null
          tier2_count?: number | null
          tier3_count?: number | null
          top_headline?: string | null
          trend_score?: number | null
          trend_stage?: string | null
          true_z_score?: number | null
          updated_at?: string | null
          velocity?: number | null
          velocity_1h?: number | null
          velocity_6h?: number | null
          weighted_evidence_score?: number | null
          z_score_velocity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_events_semantic_cluster_id_fkey"
            columns: ["semantic_cluster_id"]
            isOneToOne: false
            referencedRelation: "trend_semantic_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_evidence: {
        Row: {
          canonical_url: string | null
          content_hash: string | null
          contribution_score: number | null
          created_at: string | null
          event_id: string
          id: string
          indexed_at: string | null
          is_primary: boolean | null
          published_at: string | null
          sentiment_label: string | null
          sentiment_score: number | null
          source_domain: string | null
          source_id: string | null
          source_tier: string | null
          source_title: string | null
          source_type: string
          source_url: string | null
        }
        Insert: {
          canonical_url?: string | null
          content_hash?: string | null
          contribution_score?: number | null
          created_at?: string | null
          event_id: string
          id?: string
          indexed_at?: string | null
          is_primary?: boolean | null
          published_at?: string | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          source_domain?: string | null
          source_id?: string | null
          source_tier?: string | null
          source_title?: string | null
          source_type: string
          source_url?: string | null
        }
        Update: {
          canonical_url?: string | null
          content_hash?: string | null
          contribution_score?: number | null
          created_at?: string | null
          event_id?: string
          id?: string
          indexed_at?: string | null
          is_primary?: boolean | null
          published_at?: string | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          source_domain?: string | null
          source_id?: string | null
          source_tier?: string | null
          source_title?: string | null
          source_type?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_evidence_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "label_quality_flags"
            referencedColumns: ["trend_id"]
          },
          {
            foreignKeyName: "trend_evidence_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "trend_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_evidence_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "trend_events_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_evidence_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "trend_quality_flags"
            referencedColumns: ["trend_id"]
          },
        ]
      }
      trend_feedback: {
        Row: {
          created_at: string | null
          feedback_type: string
          id: string
          notes: string | null
          organization_id: string | null
          trend_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          feedback_type: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          trend_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          feedback_type?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          trend_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "trend_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      trend_filter_log: {
        Row: {
          domains_filtered_out: string[] | null
          domains_shown: string[] | null
          filters_applied: Json | null
          id: string
          new_opportunity_count: number | null
          organization_id: string | null
          request_at: string | null
          total_trends_available: number | null
          trends_shown: number | null
          user_id: string | null
        }
        Insert: {
          domains_filtered_out?: string[] | null
          domains_shown?: string[] | null
          filters_applied?: Json | null
          id?: string
          new_opportunity_count?: number | null
          organization_id?: string | null
          request_at?: string | null
          total_trends_available?: number | null
          trends_shown?: number | null
          user_id?: string | null
        }
        Update: {
          domains_filtered_out?: string[] | null
          domains_shown?: string[] | null
          filters_applied?: Json | null
          id?: string
          new_opportunity_count?: number | null
          organization_id?: string | null
          request_at?: string | null
          total_trends_available?: number | null
          trends_shown?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_filter_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_filter_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "trend_filter_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      trend_outcome_correlation: {
        Row: {
          actions_sent: number | null
          avg_donation: number | null
          baseline_response_rate: number | null
          computed_at: string | null
          donation_rate: number | null
          id: string
          learning_signal: string | null
          organization_id: string
          performance_delta: number | null
          response_rate: number | null
          should_boost_relevance: boolean | null
          total_clicks: number | null
          total_donation_amount: number | null
          total_donations: number | null
          total_outcomes: number | null
          trend_event_id: string | null
          trend_key: string
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          actions_sent?: number | null
          avg_donation?: number | null
          baseline_response_rate?: number | null
          computed_at?: string | null
          donation_rate?: number | null
          id?: string
          learning_signal?: string | null
          organization_id: string
          performance_delta?: number | null
          response_rate?: number | null
          should_boost_relevance?: boolean | null
          total_clicks?: number | null
          total_donation_amount?: number | null
          total_donations?: number | null
          total_outcomes?: number | null
          trend_event_id?: string | null
          trend_key: string
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          actions_sent?: number | null
          avg_donation?: number | null
          baseline_response_rate?: number | null
          computed_at?: string | null
          donation_rate?: number | null
          id?: string
          learning_signal?: string | null
          organization_id?: string
          performance_delta?: number | null
          response_rate?: number | null
          should_boost_relevance?: boolean | null
          total_clicks?: number | null
          total_donation_amount?: number | null
          total_donations?: number | null
          total_outcomes?: number | null
          trend_event_id?: string | null
          trend_key?: string
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_outcome_correlation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_outcome_correlation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "trend_outcome_correlation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      trend_phrase_clusters: {
        Row: {
          canonical_event_id: string | null
          canonical_phrase: string
          created_at: string | null
          id: string
          member_event_keys: string[] | null
          member_phrases: string[] | null
          similarity_threshold: number | null
          top_authority_score: number | null
          total_mentions: number | null
          updated_at: string | null
        }
        Insert: {
          canonical_event_id?: string | null
          canonical_phrase: string
          created_at?: string | null
          id?: string
          member_event_keys?: string[] | null
          member_phrases?: string[] | null
          similarity_threshold?: number | null
          top_authority_score?: number | null
          total_mentions?: number | null
          updated_at?: string | null
        }
        Update: {
          canonical_event_id?: string | null
          canonical_phrase?: string
          created_at?: string | null
          id?: string
          member_event_keys?: string[] | null
          member_phrases?: string[] | null
          similarity_threshold?: number | null
          top_authority_score?: number | null
          total_mentions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_phrase_clusters_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "label_quality_flags"
            referencedColumns: ["trend_id"]
          },
          {
            foreignKeyName: "trend_phrase_clusters_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "trend_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_phrase_clusters_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "trend_events_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_phrase_clusters_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "trend_quality_flags"
            referencedColumns: ["trend_id"]
          },
        ]
      }
      trend_semantic_clusters: {
        Row: {
          avg_confidence: number | null
          avg_velocity: number | null
          centroid_keywords: string[] | null
          cluster_description: string | null
          cluster_name: string
          created_at: string | null
          id: string
          member_trend_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          avg_confidence?: number | null
          avg_velocity?: number | null
          centroid_keywords?: string[] | null
          cluster_description?: string | null
          cluster_name: string
          created_at?: string | null
          id?: string
          member_trend_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          avg_confidence?: number | null
          avg_velocity?: number | null
          centroid_keywords?: string[] | null
          cluster_description?: string | null
          cluster_name?: string
          created_at?: string | null
          id?: string
          member_trend_ids?: string[] | null
          updated_at?: string | null
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
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invitation_type: string
          invited_by: string | null
          organization_id: string | null
          resend_count: number
          role: string | null
          status: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invitation_type: string
          invited_by?: string | null
          organization_id?: string | null
          resend_count?: number
          role?: string | null
          status?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invitation_type?: string
          invited_by?: string | null
          organization_id?: string | null
          resend_count?: number
          role?: string | null
          status?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "user_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          {
            foreignKeyName: "watchlist_usage_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "watchlist_usage_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
          metadata: Json | null
          organization_id: string | null
          payload: Json | null
          platform: string
          processed_at: string | null
          processing_status: string | null
          received_at: string | null
          reprocessed_at: string | null
          success: boolean | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          headers?: Json | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          payload?: Json | null
          platform: string
          processed_at?: string | null
          processing_status?: string | null
          received_at?: string | null
          reprocessed_at?: string | null
          success?: boolean | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          headers?: Json | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          payload?: Json | null
          platform?: string
          processed_at?: string | null
          processing_status?: string | null
          received_at?: string | null
          reprocessed_at?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "webhook_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
    }
    Views: {
      ab_test_performance: {
        Row: {
          ab_test_name: string | null
          ab_test_variation: string | null
          avg_donation: number | null
          donations: number | null
          first_donation: string | null
          last_donation: string | null
          net_raised: number | null
          organization_id: string | null
          recurring_donations: number | null
          total_raised: number | null
          unique_donors: number | null
        }
        Relationships: [
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      actblue_daily_rollup: {
        Row: {
          day: string | null
          donation_count: number | null
          gross_donations: number | null
          net_donations: number | null
          net_revenue: number | null
          organization_id: string | null
          recurring_amount: number | null
          recurring_count: number | null
          refund_amount: number | null
          refund_count: number | null
          total_fees: number | null
          unique_donors: number | null
        }
        Relationships: [
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      actblue_transactions_secure: {
        Row: {
          ab_test_name: string | null
          ab_test_variation: string | null
          addr1: string | null
          amount: number | null
          card_type: string | null
          city: string | null
          click_id: string | null
          committee_name: string | null
          contribution_form: string | null
          country: string | null
          created_at: string | null
          custom_fields: Json | null
          donor_email: string | null
          donor_name: string | null
          double_down: boolean | null
          employer: string | null
          entity_id: string | null
          fbclid: string | null
          fec_id: string | null
          fee: number | null
          first_name: string | null
          id: string | null
          is_express: boolean | null
          is_mobile: boolean | null
          is_recurring: boolean | null
          last_name: string | null
          lineitem_id: number | null
          net_amount: number | null
          next_charge_date: string | null
          occupation: string | null
          order_number: string | null
          organization_id: string | null
          payment_method: string | null
          phone: string | null
          receipt_id: string | null
          recurring_duration: number | null
          recurring_period: string | null
          recurring_state: string | null
          recurring_upsell_shown: boolean | null
          recurring_upsell_succeeded: boolean | null
          refcode: string | null
          refcode_custom: string | null
          refcode2: string | null
          smart_boost_amount: number | null
          source_campaign: string | null
          state: string | null
          text_message_option: string | null
          transaction_date: string | null
          transaction_id: string | null
          transaction_type: string | null
          zip: string | null
        }
        Insert: {
          ab_test_name?: string | null
          ab_test_variation?: string | null
          addr1?: string | null
          amount?: number | null
          card_type?: string | null
          city?: string | null
          click_id?: string | null
          committee_name?: string | null
          contribution_form?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          donor_email?: string | null
          donor_name?: string | null
          double_down?: boolean | null
          employer?: string | null
          entity_id?: string | null
          fbclid?: string | null
          fec_id?: string | null
          fee?: number | null
          first_name?: string | null
          id?: string | null
          is_express?: boolean | null
          is_mobile?: boolean | null
          is_recurring?: boolean | null
          last_name?: string | null
          lineitem_id?: number | null
          net_amount?: number | null
          next_charge_date?: string | null
          occupation?: string | null
          order_number?: string | null
          organization_id?: string | null
          payment_method?: string | null
          phone?: string | null
          receipt_id?: string | null
          recurring_duration?: number | null
          recurring_period?: string | null
          recurring_state?: string | null
          recurring_upsell_shown?: boolean | null
          recurring_upsell_succeeded?: boolean | null
          refcode?: string | null
          refcode_custom?: string | null
          refcode2?: string | null
          smart_boost_amount?: number | null
          source_campaign?: string | null
          state?: string | null
          text_message_option?: string | null
          transaction_date?: string | null
          transaction_id?: string | null
          transaction_type?: string | null
          zip?: string | null
        }
        Update: {
          ab_test_name?: string | null
          ab_test_variation?: string | null
          addr1?: string | null
          amount?: number | null
          card_type?: string | null
          city?: string | null
          click_id?: string | null
          committee_name?: string | null
          contribution_form?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          donor_email?: string | null
          donor_name?: string | null
          double_down?: boolean | null
          employer?: string | null
          entity_id?: string | null
          fbclid?: string | null
          fec_id?: string | null
          fee?: number | null
          first_name?: string | null
          id?: string | null
          is_express?: boolean | null
          is_mobile?: boolean | null
          is_recurring?: boolean | null
          last_name?: string | null
          lineitem_id?: number | null
          net_amount?: number | null
          next_charge_date?: string | null
          occupation?: string | null
          order_number?: string | null
          organization_id?: string | null
          payment_method?: string | null
          phone?: string | null
          receipt_id?: string | null
          recurring_duration?: number | null
          recurring_period?: string | null
          recurring_state?: string | null
          recurring_upsell_shown?: boolean | null
          recurring_upsell_succeeded?: boolean | null
          refcode?: string | null
          refcode_custom?: string | null
          refcode2?: string | null
          smart_boost_amount?: number | null
          source_campaign?: string | null
          state?: string | null
          text_message_option?: string | null
          transaction_date?: string | null
          transaction_id?: string | null
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
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      action_effectiveness_summary: {
        Row: {
          action_type: string | null
          avg_outcome_value: number | null
          success_rate: number | null
          successful_actions: number | null
          total_actions: number | null
          total_outcome_value: number | null
          trend_label: string | null
        }
        Relationships: []
      }
      action_outcome_summary: {
        Row: {
          action_id: string | null
          action_type: string | null
          copy_variant: string | null
          donation_count: number | null
          donation_total: number | null
          entity_name: string | null
          meta_outcomes: number | null
          organization_id: string | null
          sent_at: string | null
          sms_outcomes: number | null
          total_outcomes: number | null
          trend_event_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "intelligence_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      ad_refcode_overlap: {
        Row: {
          ad_count: number | null
          ads: Json | null
          has_date_overlap: boolean | null
          organization_id: string | null
          refcode: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refcode_mapping_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refcode_mapping_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "refcode_mapping_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      admin_audit_logs_secure: {
        Row: {
          action_type: string | null
          created_at: string | null
          id: string | null
          ip_address: string | null
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_affected: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string | null
          id?: string | null
          ip_address?: never
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_affected?: string | null
          user_agent?: never
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          created_at?: string | null
          id?: string | null
          ip_address?: never
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_affected?: string | null
          user_agent?: never
          user_id?: string | null
        }
        Relationships: []
      }
      admin_invite_codes_secure: {
        Row: {
          code: string | null
          created_at: string | null
          created_by: string | null
          email_error: string | null
          email_sent_at: string | null
          email_sent_to: string | null
          email_status: string | null
          expires_at: string | null
          id: string | null
          is_active: boolean | null
          resend_count: number | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          email_error?: never
          email_sent_at?: string | null
          email_sent_to?: never
          email_status?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          resend_count?: number | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          created_by?: string | null
          email_error?: never
          email_sent_at?: string | null
          email_sent_to?: never
          email_status?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          resend_count?: number | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      attribution_quality_metrics: {
        Row: {
          date: string | null
          deterministic_revenue: number | null
          full_clickid_count: number | null
          full_clickid_pct: number | null
          organization_id: string | null
          probabilistic_revenue: number | null
          total_fb_donations: number | null
          total_fb_revenue: number | null
          truncated_clickid_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      attribution_touchpoints_secure: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          donor_email: string | null
          id: string | null
          metadata: Json | null
          occurred_at: string | null
          organization_id: string | null
          refcode: string | null
          touchpoint_type: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          donor_email?: never
          id?: string | null
          metadata?: Json | null
          occurred_at?: string | null
          organization_id?: string | null
          refcode?: string | null
          touchpoint_type?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          donor_email?: never
          id?: string | null
          metadata?: Json | null
          occurred_at?: string | null
          organization_id?: string | null
          refcode?: string | null
          touchpoint_type?: string | null
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
          {
            foreignKeyName: "attribution_touchpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "attribution_touchpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
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
      contact_submissions_secure: {
        Row: {
          assigned_to: string | null
          campaign: string | null
          created_at: string | null
          email: string | null
          id: string | null
          message: string | null
          name: string | null
          organization_type: string | null
          priority: string | null
          resolved_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          campaign?: string | null
          created_at?: string | null
          email?: never
          id?: string | null
          message?: string | null
          name?: never
          organization_type?: string | null
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          campaign?: string | null
          created_at?: string | null
          email?: never
          id?: string | null
          message?: string | null
          name?: never
          organization_type?: string | null
          priority?: string | null
          resolved_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_submissions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_submissions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_secure"
            referencedColumns: ["id"]
          },
        ]
      }
      data_freshness_summary: {
        Row: {
          data_lag_hours: number | null
          freshness_sla_hours: number | null
          freshness_status: string | null
          is_within_sla: boolean | null
          last_error: string | null
          last_sync_status: string | null
          last_synced_at: string | null
          latest_data_timestamp: string | null
          organization_id: string | null
          organization_name: string | null
          records_synced: number | null
          source: string | null
          source_display_name: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_freshness_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_freshness_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "data_freshness_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      donation_attribution: {
        Row: {
          amount: number | null
          attributed_ad_id: string | null
          attributed_campaign_id: string | null
          attributed_creative_id: string | null
          attributed_platform: string | null
          attribution_confidence: number | null
          attribution_method: string | null
          contribution_form: string | null
          donor_email: string | null
          donor_name: string | null
          is_recurring: boolean | null
          mapping_first_seen: string | null
          mapping_last_seen: string | null
          net_amount: number | null
          organization_id: string | null
          refcode: string | null
          source_campaign: string | null
          transaction_date: string | null
          transaction_id: string | null
          transaction_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      donation_clickid_candidates: {
        Row: {
          amount: number | null
          click_id: string | null
          donor_email: string | null
          fbclid: string | null
          net_amount: number | null
          organization_id: string | null
          transaction_date: string | null
          transaction_id: string | null
        }
        Insert: {
          amount?: number | null
          click_id?: string | null
          donor_email?: string | null
          fbclid?: string | null
          net_amount?: number | null
          organization_id?: string | null
          transaction_date?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount?: number | null
          click_id?: string | null
          donor_email?: string | null
          fbclid?: string | null
          net_amount?: number | null
          organization_id?: string | null
          transaction_date?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      donor_demographics_secure: {
        Row: {
          address: string | null
          age: number | null
          city: string | null
          country: string | null
          created_at: string | null
          donation_count: number | null
          donor_email: string | null
          employer: string | null
          first_donation_date: string | null
          first_name: string | null
          gender: string | null
          id: string | null
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
          voter_file_matched: boolean | null
          voter_score: number | null
          zip: string | null
        }
        Insert: {
          address?: never
          age?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          donation_count?: number | null
          donor_email?: never
          employer?: never
          first_donation_date?: string | null
          first_name?: never
          gender?: string | null
          id?: string | null
          is_recurring?: boolean | null
          last_donation_date?: string | null
          last_name?: never
          occupation?: never
          organization_id?: string | null
          party_affiliation?: string | null
          phone?: never
          state?: string | null
          total_donated?: number | null
          updated_at?: string | null
          voter_file_matched?: boolean | null
          voter_score?: number | null
          zip?: never
        }
        Update: {
          address?: never
          age?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          donation_count?: number | null
          donor_email?: never
          employer?: never
          first_donation_date?: string | null
          first_name?: never
          gender?: string | null
          id?: string | null
          is_recurring?: boolean | null
          last_donation_date?: string | null
          last_name?: never
          occupation?: never
          organization_id?: string | null
          party_affiliation?: string | null
          phone?: never
          state?: string | null
          total_donated?: number | null
          updated_at?: string | null
          voter_file_matched?: boolean | null
          voter_score?: number | null
          zip?: never
        }
        Relationships: [
          {
            foreignKeyName: "donor_demographics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donor_demographics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "donor_demographics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      donor_segments: {
        Row: {
          city: string | null
          days_since_donation: number | null
          donation_count: number | null
          donor_email: string | null
          donor_frequency_segment: string | null
          donor_id_hash: string | null
          donor_tier: string | null
          first_donation_date: string | null
          first_name: string | null
          frequency_score: number | null
          id: string | null
          is_recurring: boolean | null
          last_donation_date: string | null
          last_name: string | null
          monetary_score: number | null
          organization_id: string | null
          recency_score: number | null
          state: string | null
          total_donated: number | null
          zip: string | null
        }
        Insert: {
          city?: never
          days_since_donation?: never
          donation_count?: number | null
          donor_email?: never
          donor_frequency_segment?: never
          donor_id_hash?: never
          donor_tier?: never
          first_donation_date?: string | null
          first_name?: never
          frequency_score?: never
          id?: string | null
          is_recurring?: boolean | null
          last_donation_date?: string | null
          last_name?: never
          monetary_score?: never
          organization_id?: string | null
          recency_score?: never
          state?: string | null
          total_donated?: number | null
          zip?: never
        }
        Update: {
          city?: never
          days_since_donation?: never
          donation_count?: number | null
          donor_email?: never
          donor_frequency_segment?: never
          donor_id_hash?: never
          donor_tier?: never
          first_donation_date?: string | null
          first_name?: never
          frequency_score?: never
          id?: string | null
          is_recurring?: boolean | null
          last_donation_date?: string | null
          last_name?: never
          monetary_score?: never
          organization_id?: string | null
          recency_score?: never
          state?: string | null
          total_donated?: number | null
          zip?: never
        }
        Relationships: [
          {
            foreignKeyName: "donor_demographics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "donor_demographics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "donor_demographics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      label_quality_flags: {
        Row: {
          canonical_label: string | null
          confidence_score: number | null
          event_title: string | null
          evidence_count: number | null
          first_seen_at: string | null
          is_breaking: boolean | null
          label_quality: string | null
          last_seen_at: string | null
          needs_attention: boolean | null
          rank_score: number | null
          source_count: number | null
          trend_id: string | null
          trend_score: number | null
          word_count: number | null
        }
        Relationships: []
      }
      label_quality_kpis: {
        Row: {
          calculated_at: string | null
          entity_only_count: number | null
          entity_only_pct: number | null
          event_phrase_count: number | null
          event_phrase_pct: number | null
          fallback_count: number | null
          fallback_pct: number | null
          quality_score: number | null
          total_trends_24h: number | null
        }
        Relationships: []
      }
      login_history_secure: {
        Row: {
          created_at: string | null
          email: string | null
          failure_reason: string | null
          id: string | null
          ip_address: string | null
          login_successful: boolean | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: never
          failure_reason?: string | null
          id?: string | null
          ip_address?: never
          login_successful?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: never
          failure_reason?: string | null
          id?: string | null
          ip_address?: never
          login_successful?: boolean | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      meta_sync_status: {
        Row: {
          credential_id: string | null
          data_lag_days: number | null
          date_range_days: number | null
          interval_minutes: number | null
          is_active: boolean | null
          last_meta_sync_at: string | null
          last_sync_error: string | null
          last_sync_status: string | null
          latest_meta_data_date: string | null
          meta_sync_priority: string | null
          minutes_until_sync: number | null
          organization_id: string | null
          organization_name: string | null
          rate_limit_backoff_until: string | null
          sync_due: boolean | null
          sync_error_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_api_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_api_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "client_api_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
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
          {
            foreignKeyName: "daily_aggregated_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "daily_aggregated_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
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
      news_investigation_view: {
        Row: {
          ai_summary: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string | null
          processing_status: string | null
          published_date: string | null
          sentiment_label: string | null
          sentiment_score: number | null
          source_name: string | null
          source_type: string | null
          source_url: string | null
          tags: string[] | null
          threat_level: string | null
          title: string | null
        }
        Relationships: []
      }
      org_onboarding_summary: {
        Row: {
          blocking_reason: string | null
          completed_steps: Json | null
          current_step: number | null
          effective_status: string | null
          error_count: number | null
          has_profile: boolean | null
          integration_count: number | null
          is_active: boolean | null
          onboarding_status: string | null
          onboarding_updated_at: string | null
          org_created_at: string | null
          organization_id: string | null
          organization_name: string | null
          progress_percentage: number | null
          slug: string | null
          user_count: number | null
        }
        Relationships: []
      }
      org_relevant_trends: {
        Row: {
          confidence_score: number | null
          current_1h: number | null
          current_24h: number | null
          current_6h: number | null
          event_title: string | null
          explanation: Json | null
          is_breaking: boolean | null
          is_trending: boolean | null
          matched_topics: string[] | null
          organization_id: string | null
          priority_bucket: string | null
          relevance_score: number | null
          trend_key: string | null
          velocity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "org_trend_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_trend_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "org_trend_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      pipeline_backlog: {
        Row: {
          ingested_24h: number | null
          needs_extraction: number | null
          pending_count: number | null
          pipeline: string | null
          processed_24h: number | null
          processed_count: number | null
        }
        Relationships: []
      }
      pipeline_freshness: {
        Row: {
          age_minutes: number | null
          consecutive_failures: number | null
          freshness_status: string | null
          is_critical: boolean | null
          job_name: string | null
          job_type: string | null
          last_duration_ms: number | null
          last_error: string | null
          last_failure_at: string | null
          last_started_at: string | null
          last_status: string | null
          last_success_at: string | null
          minutes_until_sla_breach: number | null
          sla_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          age_minutes?: never
          consecutive_failures?: number | null
          freshness_status?: never
          is_critical?: boolean | null
          job_name?: string | null
          job_type?: string | null
          last_duration_ms?: number | null
          last_error?: string | null
          last_failure_at?: string | null
          last_started_at?: string | null
          last_status?: string | null
          last_success_at?: string | null
          minutes_until_sla_breach?: never
          sla_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          age_minutes?: never
          consecutive_failures?: number | null
          freshness_status?: never
          is_critical?: boolean | null
          job_name?: string | null
          job_type?: string | null
          last_duration_ms?: number | null
          last_error?: string | null
          last_failure_at?: string | null
          last_started_at?: string | null
          last_status?: string | null
          last_success_at?: string | null
          minutes_until_sla_breach?: never
          sla_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pipeline_health: {
        Row: {
          avg_duration_ms_24h: number | null
          failures_24h: number | null
          freshness_status: string | null
          job_name: string | null
          job_type: string | null
          last_completed_at: string | null
          last_duration_ms: number | null
          last_error: string | null
          last_records_created: number | null
          last_records_processed: number | null
          last_run_at: string | null
          last_status: string | null
          minutes_since_last_run: number | null
          records_created_24h: number | null
          runs_24h: number | null
          successes_24h: number | null
        }
        Relationships: []
      }
      profiles_secure: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          is_active: boolean | null
          last_sign_in_at: string | null
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: never
          id?: string | null
          is_active?: boolean | null
          last_sign_in_at?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: never
          id?: string | null
          is_active?: boolean | null
          last_sign_in_at?: string | null
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      source_coverage_kpis: {
        Row: {
          active_sources: number | null
          failing_sources: number | null
          google_news_count: number | null
          healthy_sources: number | null
          inactive_sources: number | null
          overall_coverage_score: number | null
          rss_count: number | null
          stale_sources: number | null
          tier1_count: number | null
          tier2_count: number | null
          tier3_count: number | null
          total_sources: number | null
          unclassified_count: number | null
        }
        Relationships: []
      }
      source_coverage_summary: {
        Row: {
          active_count: number | null
          avg_consecutive_errors: number | null
          avg_expected_cadence_mins: number | null
          coverage_score: number | null
          healthy_24h: number | null
          inactive_count: number | null
          source_count: number | null
          source_type: string | null
          sources_with_errors: number | null
          stale_24h: number | null
          tag: string | null
          tier: string | null
        }
        Relationships: []
      }
      source_health: {
        Row: {
          backoff_until: string | null
          expected_cadence_mins: number | null
          failure_count: number | null
          health_status: string | null
          id: string | null
          is_active: boolean | null
          last_error: string | null
          last_failure_at: string | null
          last_fetched_at: string | null
          last_success_at: string | null
          mins_since_success: number | null
          name: string | null
          source_type: string | null
          tags: string[] | null
          tier: string | null
          url: string | null
        }
        Relationships: []
      }
      source_health_by_tier_tag: {
        Row: {
          active_sources: number | null
          critical_sources: number | null
          deactivated_sources: number | null
          failing_sources: number | null
          healthy_sources: number | null
          source_type: string | null
          stale_sources: number | null
          tag: string | null
          tier: string | null
          total_sources: number | null
        }
        Relationships: []
      }
      source_health_summary: {
        Row: {
          active_sources: number | null
          critical_sources: number | null
          deactivated_sources: number | null
          failing_sources: number | null
          healthy_sources: number | null
          source_type: string | null
          stale_sources: number | null
          tier: string | null
          total_sources: number | null
        }
        Relationships: []
      }
      state_coverage_summary: {
        Row: {
          active_source_count: number | null
          healthy_source_count: number | null
          stale_source_count: number | null
          state_code: string | null
          state_name: string | null
        }
        Relationships: []
      }
      transaction_attribution_secure: {
        Row: {
          attribution_calculated_at: string | null
          created_at: string | null
          donor_email: string | null
          first_touch_campaign: string | null
          first_touch_channel: string | null
          first_touch_weight: number | null
          id: string | null
          last_touch_campaign: string | null
          last_touch_channel: string | null
          last_touch_weight: number | null
          middle_touches: Json | null
          middle_touches_weight: number | null
          organization_id: string | null
          total_touchpoints: number | null
          transaction_id: string | null
        }
        Insert: {
          attribution_calculated_at?: string | null
          created_at?: string | null
          donor_email?: never
          first_touch_campaign?: string | null
          first_touch_channel?: string | null
          first_touch_weight?: number | null
          id?: string | null
          last_touch_campaign?: string | null
          last_touch_channel?: string | null
          last_touch_weight?: number | null
          middle_touches?: Json | null
          middle_touches_weight?: number | null
          organization_id?: string | null
          total_touchpoints?: number | null
          transaction_id?: string | null
        }
        Update: {
          attribution_calculated_at?: string | null
          created_at?: string | null
          donor_email?: never
          first_touch_campaign?: string | null
          first_touch_channel?: string | null
          first_touch_weight?: number | null
          id?: string | null
          last_touch_campaign?: string | null
          last_touch_channel?: string | null
          last_touch_weight?: number | null
          middle_touches?: Json | null
          middle_touches_weight?: number | null
          organization_id?: string | null
          total_touchpoints?: number | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_attribution_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_attribution_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "transaction_attribution_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      trend_events_active: {
        Row: {
          acceleration: number | null
          alias_variants: string[] | null
          baseline_30d: number | null
          baseline_7d: number | null
          canonical_label: string | null
          confidence_factors: Json | null
          confidence_score: number | null
          corroboration_score: number | null
          current_1h: number | null
          current_24h: number | null
          current_6h: number | null
          entity_type: string | null
          event_key: string | null
          event_title: string | null
          evergreen_penalty: number | null
          evidence_count: number | null
          first_seen_at: string | null
          has_tier12_corroboration: boolean | null
          id: string | null
          is_breaking: boolean | null
          is_event_phrase: boolean | null
          is_tier3_only: boolean | null
          is_trending: boolean | null
          is_verified: boolean | null
          label_quality: string | null
          last_seen_at: string | null
          news_source_count: number | null
          peak_at: string | null
          rank_score: number | null
          recency_decay: number | null
          related_entities: string[] | null
          related_phrases: string[] | null
          related_topics: string[] | null
          sentiment_label: string | null
          sentiment_score: number | null
          social_source_count: number | null
          source_count: number | null
          tier1_count: number | null
          tier2_count: number | null
          tier3_count: number | null
          top_headline: string | null
          trend_score: number | null
          trend_stage: string | null
          updated_at: string | null
          velocity: number | null
          velocity_1h: number | null
          velocity_6h: number | null
          weighted_evidence_score: number | null
          z_score_velocity: number | null
        }
        Insert: {
          acceleration?: number | null
          alias_variants?: string[] | null
          baseline_30d?: number | null
          baseline_7d?: number | null
          canonical_label?: string | null
          confidence_factors?: Json | null
          confidence_score?: number | null
          corroboration_score?: number | null
          current_1h?: number | null
          current_24h?: number | null
          current_6h?: number | null
          entity_type?: string | null
          event_key?: string | null
          event_title?: string | null
          evergreen_penalty?: number | null
          evidence_count?: number | null
          first_seen_at?: string | null
          has_tier12_corroboration?: boolean | null
          id?: string | null
          is_breaking?: boolean | null
          is_event_phrase?: boolean | null
          is_tier3_only?: boolean | null
          is_trending?: boolean | null
          is_verified?: boolean | null
          label_quality?: string | null
          last_seen_at?: string | null
          news_source_count?: number | null
          peak_at?: string | null
          rank_score?: number | null
          recency_decay?: number | null
          related_entities?: string[] | null
          related_phrases?: string[] | null
          related_topics?: string[] | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          social_source_count?: number | null
          source_count?: number | null
          tier1_count?: number | null
          tier2_count?: number | null
          tier3_count?: number | null
          top_headline?: string | null
          trend_score?: number | null
          trend_stage?: string | null
          updated_at?: string | null
          velocity?: number | null
          velocity_1h?: number | null
          velocity_6h?: number | null
          weighted_evidence_score?: number | null
          z_score_velocity?: number | null
        }
        Update: {
          acceleration?: number | null
          alias_variants?: string[] | null
          baseline_30d?: number | null
          baseline_7d?: number | null
          canonical_label?: string | null
          confidence_factors?: Json | null
          confidence_score?: number | null
          corroboration_score?: number | null
          current_1h?: number | null
          current_24h?: number | null
          current_6h?: number | null
          entity_type?: string | null
          event_key?: string | null
          event_title?: string | null
          evergreen_penalty?: number | null
          evidence_count?: number | null
          first_seen_at?: string | null
          has_tier12_corroboration?: boolean | null
          id?: string | null
          is_breaking?: boolean | null
          is_event_phrase?: boolean | null
          is_tier3_only?: boolean | null
          is_trending?: boolean | null
          is_verified?: boolean | null
          label_quality?: string | null
          last_seen_at?: string | null
          news_source_count?: number | null
          peak_at?: string | null
          rank_score?: number | null
          recency_decay?: number | null
          related_entities?: string[] | null
          related_phrases?: string[] | null
          related_topics?: string[] | null
          sentiment_label?: string | null
          sentiment_score?: number | null
          social_source_count?: number | null
          source_count?: number | null
          tier1_count?: number | null
          tier2_count?: number | null
          tier3_count?: number | null
          top_headline?: string | null
          trend_score?: number | null
          trend_stage?: string | null
          updated_at?: string | null
          velocity?: number | null
          velocity_1h?: number | null
          velocity_6h?: number | null
          weighted_evidence_score?: number | null
          z_score_velocity?: number | null
        }
        Relationships: []
      }
      trend_quality_flags: {
        Row: {
          confidence_score: number | null
          event_title: string | null
          evergreen_penalty: number | null
          evergreen_suppressed_flag: boolean | null
          evidence_count: number | null
          flag_count: number | null
          label_quality: string | null
          low_burst_flag: boolean | null
          low_confidence_flag: boolean | null
          low_corroboration_flag: boolean | null
          low_evidence_flag: boolean | null
          quality_score: number | null
          rank_score: number | null
          recency_decay: number | null
          single_word_flag: boolean | null
          stale_flag: boolean | null
          stale_recency_flag: boolean | null
          tier1_count: number | null
          tier2_count: number | null
          tier3_count: number | null
          tier3_only_flag: boolean | null
          trend_id: string | null
          z_score_velocity: number | null
        }
        Relationships: []
      }
      trend_quality_kpis: {
        Row: {
          avg_confidence_score: number | null
          avg_evergreen_penalty: number | null
          avg_evidence_count: number | null
          avg_rank_score: number | null
          avg_recency_decay: number | null
          avg_velocity: number | null
          avg_weighted_evidence_score: number | null
          avg_z_score: number | null
          evergreen_suppressed_count: number | null
          pct_evidence_tier1: number | null
          pct_evidence_tier2: number | null
          pct_evidence_tier3: number | null
          pct_high_rank_score: number | null
          pct_trends_multi_source: number | null
          pct_trends_single_word: number | null
          pct_trends_tier1_corroborated: number | null
          total_trends_24h: number | null
        }
        Relationships: []
      }
      unmatched_refcodes: {
        Row: {
          first_seen: string | null
          last_seen: string | null
          organization_id: string | null
          refcode: string | null
          total_revenue: number | null
          transaction_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "org_onboarding_summary"
            referencedColumns: ["organization_id"]
          },
          {
            foreignKeyName: "actblue_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "v_integration_summary"
            referencedColumns: ["organization_id"]
          },
        ]
      }
      v_integration_summary: {
        Row: {
          disabled_count: number | null
          error_count: number | null
          health_status: string | null
          healthy_count: number | null
          integrations: Json | null
          org_is_active: boolean | null
          organization_id: string | null
          organization_name: string | null
          organization_slug: string | null
          total_count: number | null
          untested_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invitation: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      archive_old_data: {
        Args: never
        Returns: {
          articles_archived: number
          bluesky_archived: number
        }[]
      }
      attribute_transaction: {
        Args: {
          p_amount: number
          p_donor_email?: string
          p_organization_id: string
          p_refcode: string
          p_transaction_date: string
          p_transaction_id: string
        }
        Returns: {
          ad_id: string | null
          amount: number
          attributed_platform: string
          attribution_confidence: number
          attribution_method: string
          campaign_id: string | null
          created_at: string
          creative_id: string | null
          donor_email: string | null
          id: string
          metadata: Json | null
          organization_id: string
          refcode: string | null
          rule_id: string | null
          transaction_date: string
          transaction_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "attributed_donations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bulk_remove_users: {
        Args: {
          p_actor_id?: string
          p_actor_name?: string
          p_organization_id: string
          p_user_ids: string[]
        }
        Returns: Json
      }
      bulk_update_user_roles: {
        Args: {
          p_actor_id?: string
          p_actor_name?: string
          p_new_role: string
          p_organization_id: string
          p_user_ids: string[]
        }
        Returns: Json
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
        | { Args: { cron_expr: string; from_time?: string }; Returns: string }
        | { Args: { cron_schedule: string }; Returns: string }
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
      calculate_trend_confidence: {
        Args: {
          p_baseline_7d: number
          p_current_1h: number
          p_evidence_count: number
          p_news_source_count: number
          p_source_count: number
          p_velocity: number
        }
        Returns: Json
      }
      calculate_trend_velocity_v2: {
        Args: { mentions_1h: number; mentions_24h: number; mentions_6h: number }
        Returns: number
      }
      can_access_organization_data: {
        Args: { _organization_id: string }
        Returns: boolean
      }
      cancel_deletion_request: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      check_account_lockout: {
        Args: { p_email: string }
        Returns: {
          is_locked: boolean
          reason: string
          unlock_at: string
        }[]
      }
      check_article_duplicate: {
        Args: { p_canonical_url?: string; p_content_hash: string }
        Returns: {
          existing_article_id: string
          existing_source_type: string
          is_duplicate: boolean
        }[]
      }
      check_authenticated_access: { Args: never; Returns: boolean }
      check_client_data_health: { Args: { p_org_id: string }; Returns: Json }
      check_contact_rate_limit: { Args: never; Returns: boolean }
      check_failed_attempts_and_lock: {
        Args: { _user_id: string }
        Returns: Json
      }
      check_pipeline_deadman: {
        Args: never
        Returns: {
          age_minutes: number
          alert_needed: boolean
          freshness_status: string
          is_critical: boolean
          job_name: string
          job_type: string
          sla_minutes: number
        }[]
      }
      check_source_staleness: {
        Args: never
        Returns: {
          alerts_created: number
          stale_google_news: number
          stale_rss: number
        }[]
      }
      cleanup_expired_invite_codes: { Args: never; Returns: undefined }
      cleanup_old_cache: { Args: never; Returns: number }
      complete_pipeline_run: {
        Args: {
          p_error_summary?: string
          p_records_created?: number
          p_records_failed?: number
          p_records_processed?: number
          p_run_id: string
          p_status: string
        }
        Returns: undefined
      }
      cosine_similarity: { Args: { a: string; b: string }; Returns: number }
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
      debug_timezone_totals: {
        Args: { p_date: string; p_org_id: string }
        Returns: {
          donation_count: number
          gross_amount: number
          method: string
          org_timezone: string
        }[]
      }
      deduplicate_topic_name: { Args: { topic_name: string }; Returns: string }
      detect_donation_channel: {
        Args: {
          p_attributed_ad_id?: string
          p_attributed_campaign_id?: string
          p_attribution_method?: string
          p_click_id: string
          p_contribution_form: string
          p_fbclid: string
          p_refcode: string
          p_source_campaign: string
        }
        Returns: string
      }
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
      get_actblue_daily_rollup: {
        Args: {
          p_end_date: string
          p_organization_id: string
          p_start_date: string
        }
        Returns: {
          avg_donation: number
          day: string
          donation_count: number
          gross_donations: number
          net_donations: number
          net_revenue: number
          recurring_count: number
          recurring_revenue: number
          refund_count: number
          refunds: number
          total_fees: number
          unique_donors: number
        }[]
      }
      get_actblue_dashboard_metrics: {
        Args: {
          p_campaign_id?: string
          p_creative_id?: string
          p_end_date: string
          p_organization_id: string
          p_start_date: string
        }
        Returns: Json
      }
      get_actblue_filtered_rollup: {
        Args: {
          p_campaign_id?: string
          p_creative_id?: string
          p_end_date: string
          p_organization_id: string
          p_start_date: string
          p_timezone?: string
        }
        Returns: {
          day: string
          donation_count: number
          gross_raised: number
          net_raised: number
          recurring_amount: number
          recurring_count: number
          refund_amount: number
          refund_count: number
          total_fees: number
          unique_donors: number
        }[]
      }
      get_actblue_hourly_metrics: {
        Args: { _date: string; _organization_id: string; _timezone?: string }
        Returns: {
          avg_donation: number
          donation_count: number
          gross_amount: number
          hour: number
          hour_label: string
          net_amount: number
          recurring_count: number
          unique_donors: number
        }[]
      }
      get_actblue_period_summary: {
        Args: {
          p_end_date: string
          p_organization_id: string
          p_start_date: string
        }
        Returns: {
          overall_avg_donation: number
          total_donation_count: number
          total_fees: number
          total_gross_donations: number
          total_net_donations: number
          total_net_revenue: number
          total_recurring_count: number
          total_recurring_revenue: number
          total_refund_count: number
          total_refunds: number
          total_unique_donors: number
        }[]
      }
      get_actblue_true_unique_donors: {
        Args: {
          p_end_date: string
          p_organization_id: string
          p_start_date: string
          p_timezone?: string
        }
        Returns: {
          new_donors: number
          returning_donors: number
          unique_donors: number
        }[]
      }
      get_attribution_summary: {
        Args: {
          p_end_date: string
          p_organization_id: string
          p_start_date: string
        }
        Returns: {
          avg_confidence: number
          platform: string
          top_methods: Json
          total_amount: number
          total_donations: number
          unique_donors: number
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
      get_clickid_candidates: {
        Args: { _limit?: number; _organization_id: string }
        Returns: {
          amount: number
          click_id: string
          donor_email: string
          fbclid: string
          net_amount: number
          organization_id: string
          transaction_date: string
          transaction_id: string
        }[]
      }
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
      get_donation_heatmap: {
        Args: {
          _end_date: string
          _organization_id: string
          _start_date: string
          _timezone?: string
        }
        Returns: {
          count: number
          day_of_week: number
          hour: number
          value: number
        }[]
      }
      get_donor_demographics_summary: {
        Args: { _organization_id: string }
        Returns: Json
      }
      get_donor_demographics_v2: {
        Args: {
          _end_date?: string
          _organization_id: string
          _start_date?: string
        }
        Returns: Json
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
      get_invitation_by_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          invitation_type: string
          organization_id: string
          organization_name: string
          role: string
          status: string
        }[]
      }
      get_meta_accounts_due_for_sync: {
        Args: { p_limit?: number }
        Returns: {
          credential_id: string
          date_range_days: number
          interval_minutes: number
          last_sync_at: string
          minutes_overdue: number
          organization_id: string
          organization_name: string
          sync_priority: string
        }[]
      }
      get_org_seat_usage: {
        Args: { org_id: string }
        Returns: {
          available_seats: number
          bonus_seats: number
          members_count: number
          pending_invites_count: number
          pending_requests_count: number
          seat_limit: number
          total_entitled: number
          total_used: number
        }[]
      }
      get_org_trend_relevance: {
        Args: {
          p_limit?: number
          p_min_score?: number
          p_organization_id: string
        }
        Returns: {
          explanation: Json
          matched_entities: string[]
          matched_topics: string[]
          priority_bucket: string
          relevance_score: number
          trend_event_id: string
          trend_key: string
          urgency_score: number
        }[]
      }
      get_pending_invitations: {
        Args: { p_organization_id?: string; p_type?: string }
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invitation_type: string
          invited_by: string
          invited_by_email: string
          organization_id: string
          organization_name: string
          role: string
          status: string
        }[]
      }
      get_recent_donations: {
        Args: {
          _date: string
          _limit?: number
          _organization_id: string
          _timezone?: string
        }
        Returns: {
          amount: number
          donor_first_name: string
          id: string
          is_recurring: boolean
          net_amount: number
          refcode: string
          transaction_date: string
        }[]
      }
      get_recurring_health: {
        Args: {
          _end_date: string
          _organization_id: string
          _start_date: string
        }
        Returns: {
          active_recurring: number
          avg_recurring_amount: number
          cancelled_recurring: number
          failed_recurring: number
          mrr: number
          paused_recurring: number
          recurring_donor_count: number
          total_recurring_revenue: number
          upsell_rate: number
          upsell_shown: number
          upsell_succeeded: number
        }[]
      }
      get_recurring_health_v2: {
        Args: {
          _end_date: string
          _organization_id: string
          _start_date: string
        }
        Returns: {
          avg_recurring_amount: number
          current_active_donors: number
          current_active_mrr: number
          current_cancelled_donors: number
          current_churned_donors: number
          current_failed_donors: number
          current_paused_donors: number
          new_recurring_donors: number
          new_recurring_mrr: number
          period_recurring_revenue: number
          period_recurring_transactions: number
          upsell_rate: number
          upsell_shown: number
          upsell_succeeded: number
        }[]
      }
      get_sms_metrics: {
        Args: {
          p_end_date: string
          p_organization_id: string
          p_start_date: string
        }
        Returns: Json
      }
      get_state_city_breakdown: {
        Args: { _organization_id: string; _state_abbr: string }
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
      get_today_comparison_metrics: {
        Args: { _date: string; _organization_id: string; _timezone?: string }
        Returns: {
          avg_donation: number
          donation_count: number
          gross_amount: number
          net_amount: number
          period_name: string
          recurring_count: number
          unique_donors: number
        }[]
      }
      get_user_organization_id: { Args: never; Returns: string }
      get_user_organization_id_safe: { Args: never; Returns: string }
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
      get_users_with_roles_and_orgs: {
        Args: never
        Returns: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_sign_in_at: string
          organizations: Json
          roles: string[]
        }[]
      }
      has_pii_access:
        | { Args: never; Returns: boolean }
        | { Args: { _organization_id: string }; Returns: boolean }
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
      is_account_locked: { Args: { _user_id: string }; Returns: boolean }
      is_client_admin: { Args: never; Returns: boolean }
      is_org_admin_or_manager: { Args: never; Returns: boolean }
      is_system_admin: { Args: never; Returns: boolean }
      is_trend_breaking: {
        Args: {
          p_baseline_7d: number
          p_current_1h: number
          p_first_seen_at: string
          p_news_source_count: number
          p_source_count: number
          p_velocity: number
        }
        Returns: boolean
      }
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
      log_invitation_event: {
        Args: {
          p_email?: string
          p_error_message?: string
          p_event_type: string
          p_invitation_id: string
          p_invitation_type?: string
          p_metadata?: Json
          p_organization_id?: string
          p_source?: string
          p_status?: string
          p_user_id?: string
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
      log_member_invited: {
        Args: {
          p_actor_id: string
          p_actor_name: string
          p_organization_id: string
          p_role: string
          p_target_email: string
          p_target_name: string
        }
        Returns: undefined
      }
      log_member_joined: {
        Args: {
          p_organization_id: string
          p_role: string
          p_user_id: string
          p_user_name: string
        }
        Returns: undefined
      }
      log_onboarding_action: {
        Args: {
          _action_type: string
          _details?: Json
          _organization_id: string
          _step?: number
        }
        Returns: string
      }
      log_pipeline_run: {
        Args: {
          p_error_details?: Json
          p_error_summary?: string
          p_idempotency_key?: string
          p_job_name?: string
          p_job_type: string
          p_records_created?: number
          p_records_failed?: number
          p_records_processed?: number
          p_status?: string
          p_triggered_by?: string
        }
        Returns: string
      }
      log_seat_change: {
        Args: {
          p_change_type: string
          p_changed_by: string
          p_new_bonus?: number
          p_new_limit?: number
          p_old_bonus?: number
          p_old_limit?: number
          p_org_id: string
          p_reason?: string
        }
        Returns: string
      }
      mask_address: { Args: { address_input: string }; Returns: string }
      mask_email: { Args: { email_input: string }; Returns: string }
      mask_name: { Args: { name_input: string }; Returns: string }
      mask_phone: { Args: { phone_input: string }; Returns: string }
      match_refcode_to_platform: {
        Args: { p_organization_id?: string; p_refcode: string }
        Returns: {
          confidence: number
          match_type: string
          platform: string
          rule_id: string
        }[]
      }
      record_login_attempt: {
        Args: {
          p_email: string
          p_failure_reason?: string
          p_ip_address: unknown
          p_success: boolean
          p_user_agent: string
        }
        Returns: undefined
      }
      refresh_analytics_views: { Args: never; Returns: undefined }
      refresh_daily_group_sentiment: { Args: never; Returns: undefined }
      refresh_daily_metrics_summary: { Args: never; Returns: undefined }
      refresh_materialized_view: {
        Args: { view_name: string }
        Returns: undefined
      }
      refresh_unified_trends: { Args: never; Returns: undefined }
      request_account_deletion: { Args: { p_reason?: string }; Returns: string }
      request_data_export: { Args: { p_format?: string }; Returns: string }
      reset_circuit_breaker: { Args: { job_id: string }; Returns: undefined }
      resolve_job_failure: {
        Args: { p_failure_id: string }
        Returns: undefined
      }
      run_attribution_batch: {
        Args: {
          p_end_date?: string
          p_force_reprocess?: boolean
          p_organization_id: string
          p_start_date?: string
        }
        Returns: string
      }
      unlock_account: {
        Args: { _admin_id: string; _user_id: string }
        Returns: boolean
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
      update_capi_health_stats: {
        Args: {
          p_error?: string
          p_organization_id: string
          p_success: boolean
        }
        Returns: undefined
      }
      update_data_freshness: {
        Args: {
          p_duration_ms?: number
          p_error?: string
          p_latest_data_timestamp?: string
          p_organization_id?: string
          p_records_synced?: number
          p_source: string
          p_sync_status?: string
        }
        Returns: string
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
      update_meta_sync_status: {
        Args: {
          p_error?: string
          p_is_rate_limited?: boolean
          p_latest_data_date?: string
          p_organization_id: string
          p_status: string
        }
        Returns: undefined
      }
      update_pipeline_heartbeat: {
        Args: {
          p_duration_ms?: number
          p_error?: string
          p_job_type: string
          p_records_created?: number
          p_records_processed?: number
          p_status: string
        }
        Returns: string
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
      update_source_health: {
        Args: {
          p_error_message?: string
          p_items_fetched?: number
          p_source_id: string
          p_source_type: string
          p_success: boolean
        }
        Returns: undefined
      }
      update_user_consent: {
        Args: {
          p_consent_type: string
          p_granted: boolean
          p_ip_address?: unknown
          p_user_agent?: string
        }
        Returns: string
      }
      user_belongs_to_organization: {
        Args: { _organization_id: string }
        Returns: boolean
      }
      user_needs_mfa: { Args: { _user_id: string }; Returns: Json }
      validate_password_strength: {
        Args: { p_password: string }
        Returns: {
          is_valid: boolean
          issues: string[]
          score: number
        }[]
      }
      verify_admin_invite_code: {
        Args: { invite_code: string; user_id: string }
        Returns: boolean
      }
      verify_and_use_admin_invite: {
        Args: { p_code: string; p_user_id: string }
        Returns: {
          error_message: string
          invite_id: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      attribution_channel: "meta" | "sms" | "email" | "other" | "unattributed"
      creative_type: "image" | "video" | "carousel" | "collection" | "slideshow"
      org_role: "admin" | "manager" | "editor" | "viewer"
      user_status: "pending" | "active" | "inactive" | "suspended"
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
      attribution_channel: ["meta", "sms", "email", "other", "unattributed"],
      creative_type: ["image", "video", "carousel", "collection", "slideshow"],
      org_role: ["admin", "manager", "editor", "viewer"],
      user_status: ["pending", "active", "inactive", "suspended"],
    },
  },
} as const
