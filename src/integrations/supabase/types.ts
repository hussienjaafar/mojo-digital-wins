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
          affected_organizations: string[] | null
          ai_summary: string | null
          category: string | null
          content: string | null
          created_at: string | null
          description: string | null
          duplicate_of: string | null
          extracted_topics: Json | null
          geographic_scope: string | null
          hash_signature: string | null
          id: string
          image_url: string | null
          is_duplicate: boolean | null
          processing_status: string | null
          published_date: string
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
        }
        Insert: {
          affected_organizations?: string[] | null
          ai_summary?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          description?: string | null
          duplicate_of?: string | null
          extracted_topics?: Json | null
          geographic_scope?: string | null
          hash_signature?: string | null
          id?: string
          image_url?: string | null
          is_duplicate?: boolean | null
          processing_status?: string | null
          published_date: string
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
        }
        Update: {
          affected_organizations?: string[] | null
          ai_summary?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          description?: string | null
          duplicate_of?: string | null
          extracted_topics?: Json | null
          geographic_scope?: string | null
          hash_signature?: string | null
          id?: string
          image_url?: string | null
          is_duplicate?: boolean | null
          processing_status?: string | null
          published_date?: string
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
          reply_to: string | null
          text: string | null
          urls: string[] | null
        }
        Insert: {
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
          reply_to?: string | null
          text?: string | null
          urls?: string[] | null
        }
        Update: {
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
          reply_to?: string | null
          text?: string | null
          urls?: string[] | null
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
          id: string
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
          id?: string
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
          id?: string
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
          organization_name?: string
          relevance_score?: number | null
          sentiment?: string | null
          source_id?: string
          source_type?: string
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
          created_at: string | null
          fetch_error: string | null
          geographic_scope: string | null
          id: string
          is_active: boolean | null
          last_fetched_at: string | null
          logo_url: string | null
          name: string
          updated_at: string | null
          url: string
        }
        Insert: {
          category: string
          created_at?: string | null
          fetch_error?: string | null
          geographic_scope?: string | null
          id?: string
          is_active?: boolean | null
          last_fetched_at?: string | null
          logo_url?: string | null
          name: string
          updated_at?: string | null
          url: string
        }
        Update: {
          category?: string
          created_at?: string | null
          fetch_error?: string | null
          geographic_scope?: string | null
          id?: string
          is_active?: boolean | null
          last_fetched_at?: string | null
          logo_url?: string | null
          name?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      scheduled_jobs: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          is_active: boolean | null
          job_name: string
          job_type: string
          last_run_at: string | null
          next_run_at: string | null
          payload: Json | null
          schedule: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          is_active?: boolean | null
          job_name: string
          job_type: string
          last_run_at?: string | null
          next_run_at?: string | null
          payload?: Json | null
          schedule: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          is_active?: boolean | null
          job_name?: string
          job_type?: string
          last_run_at?: string | null
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
          negative_count: number | null
          neutral_count: number | null
          peak_position: number | null
          positive_count: number | null
          related_keywords: string[] | null
          sample_titles: string[] | null
          topic: string
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
          negative_count?: number | null
          neutral_count?: number | null
          peak_position?: number | null
          positive_count?: number | null
          related_keywords?: string[] | null
          sample_titles?: string[] | null
          topic: string
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
          negative_count?: number | null
          neutral_count?: number | null
          peak_position?: number | null
          positive_count?: number | null
          related_keywords?: string[] | null
          sample_titles?: string[] | null
          topic?: string
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
      calculate_bluesky_trend_velocity: {
        Args: { topic_name: string }
        Returns: number
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
