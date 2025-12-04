import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TopicArticle {
  id: string;
  title: string;
  description?: string;
  source_url: string;
  source_name: string;
  published_date: string;
  sentiment_label?: string;
  type: 'news' | 'social';
}

export interface TopicSentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
  avgScore: number;
}

export interface TopicContentResult {
  topic: string;
  articles: TopicArticle[];
  socialPosts: TopicArticle[];
  totalCount: number;
  sentiment: TopicSentimentBreakdown;
  relatedEntities: string[];
  trendingStarted: string | null;
  isOnWatchlist: boolean;
}

export const useTopicContent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState<TopicContentResult | null>(null);

  const fetchTopicContent = async (topic: string, sourceTypes: string[] = ['news', 'social']) => {
    setIsLoading(true);
    setContent(null);

    try {
      const results: TopicArticle[] = [];
      const socialResults: TopicArticle[] = [];
      let sentiment: TopicSentimentBreakdown = { positive: 0, neutral: 0, negative: 0, avgScore: 0 };
      let relatedEntities: string[] = [];
      let trendingStarted: string | null = null;
      let isOnWatchlist = false;

      // Fetch trending info, watchlist check, and content in parallel
      const [trendingResult, watchlistResult] = await Promise.all([
        supabase
          .from('bluesky_trends')
          .select('trending_since, sentiment_positive, sentiment_neutral, sentiment_negative, sentiment_avg')
          .eq('topic', topic)
          .maybeSingle(),
        supabase
          .from('entity_watchlist')
          .select('id')
          .ilike('entity_name', `%${topic}%`)
          .limit(1)
      ]);

      if (trendingResult.data) {
        trendingStarted = trendingResult.data.trending_since;
        sentiment = {
          positive: trendingResult.data.sentiment_positive || 0,
          neutral: trendingResult.data.sentiment_neutral || 0,
          negative: trendingResult.data.sentiment_negative || 0,
          avgScore: trendingResult.data.sentiment_avg || 0
        };
      }

      isOnWatchlist = (watchlistResult.data?.length || 0) > 0;

      // If source includes 'news', fetch from trending_topics -> articles
      if (sourceTypes.includes('news')) {
        const { data: trendingData } = await supabase
          .from('trending_topics')
          .select('article_ids')
          .eq('topic', topic)
          .order('hour_timestamp', { ascending: false })
          .limit(1);

        if (trendingData && trendingData.length > 0 && trendingData[0].article_ids?.length > 0) {
          const { data: articles } = await supabase
            .from('articles')
            .select('id, title, description, source_url, source_name, published_date, sentiment_label, affected_groups, affected_organizations')
            .in('id', trendingData[0].article_ids)
            .order('published_date', { ascending: false })
            .limit(15);

          if (articles) {
            results.push(...articles.map(a => ({ ...a, type: 'news' as const })));
            // Extract related entities from articles
            const entities = new Set<string>();
            articles.forEach(a => {
              a.affected_groups?.forEach((g: string) => entities.add(g));
              a.affected_organizations?.forEach((o: string) => entities.add(o));
            });
            relatedEntities = Array.from(entities).slice(0, 5);
          }
        }

        // Also search articles by topic in extracted_topics or title
        if (results.length < 5) {
          const { data: searchArticles } = await supabase
            .from('articles')
            .select('id, title, description, source_url, source_name, published_date, sentiment_label, affected_groups, affected_organizations')
            .or(`title.ilike.%${topic}%,description.ilike.%${topic}%`)
            .order('published_date', { ascending: false })
            .limit(10);

          if (searchArticles) {
            const existingIds = new Set(results.map(r => r.id));
            const newArticles = searchArticles.filter(a => !existingIds.has(a.id));
            results.push(...newArticles.map(a => ({ ...a, type: 'news' as const })));
            
            // More related entities
            if (relatedEntities.length < 5) {
              const entities = new Set<string>(relatedEntities);
              newArticles.forEach(a => {
                a.affected_groups?.forEach((g: string) => entities.add(g));
                a.affected_organizations?.forEach((o: string) => entities.add(o));
              });
              relatedEntities = Array.from(entities).slice(0, 5);
            }
          }
        }
      }

      // If source includes 'social', fetch from bluesky_posts
      if (sourceTypes.includes('social')) {
        const { data: posts } = await supabase
          .from('bluesky_posts')
          .select('id, text, author_handle, created_at, post_uri, ai_sentiment_label')
          .contains('ai_topics', [topic])
          .order('created_at', { ascending: false })
          .limit(15);

        if (posts && posts.length > 0) {
          socialResults.push(...posts.map(p => ({
            id: p.id,
            title: p.text?.substring(0, 200) || 'No content',
            description: `@${p.author_handle || 'unknown'}`,
            source_url: p.post_uri || '#',
            source_name: 'Bluesky',
            published_date: p.created_at,
            sentiment_label: p.ai_sentiment_label,
            type: 'social' as const
          })));
        }

        // Also try searching by text if no exact topic match
        if (socialResults.length < 3) {
          const { data: searchPosts } = await supabase
            .from('bluesky_posts')
            .select('id, text, author_handle, created_at, post_uri, ai_sentiment_label')
            .ilike('text', `%${topic}%`)
            .order('created_at', { ascending: false })
            .limit(10);

          if (searchPosts) {
            const existingIds = new Set(socialResults.map(r => r.id));
            const newPosts = searchPosts.filter(p => !existingIds.has(p.id));
            socialResults.push(...newPosts.map(p => ({
              id: p.id,
              title: p.text?.substring(0, 200) || 'No content',
              description: `@${p.author_handle || 'unknown'}`,
              source_url: p.post_uri || '#',
              source_name: 'Bluesky',
              published_date: p.created_at,
              sentiment_label: p.ai_sentiment_label,
              type: 'social' as const
            })));
          }
        }
      }

      // Calculate sentiment from content if not from bluesky_trends
      if (sentiment.positive === 0 && sentiment.neutral === 0 && sentiment.negative === 0) {
        const allItems = [...results, ...socialResults];
        allItems.forEach(item => {
          if (item.sentiment_label === 'positive') sentiment.positive++;
          else if (item.sentiment_label === 'negative') sentiment.negative++;
          else sentiment.neutral++;
        });
      }

      setContent({
        topic,
        articles: results.slice(0, 15),
        socialPosts: socialResults.slice(0, 15),
        totalCount: results.length + socialResults.length,
        sentiment,
        relatedEntities,
        trendingStarted,
        isOnWatchlist
      });

    } catch (error: any) {
      console.error('Error fetching topic content:', error);
      toast.error('Failed to load topic content');
      setContent({ 
        topic, 
        articles: [], 
        socialPosts: [], 
        totalCount: 0, 
        sentiment: { positive: 0, neutral: 0, negative: 0, avgScore: 0 },
        relatedEntities: [],
        trendingStarted: null,
        isOnWatchlist: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addToWatchlist = async (entityName: string) => {
    try {
      const { error } = await supabase
        .from('entity_watchlist')
        .insert({ entity_name: entityName, entity_type: 'topic', priority: 'medium' });
      
      if (error) throw error;
      toast.success(`"${entityName}" added to watchlist`);
      
      // Update local state
      if (content) {
        setContent({ ...content, isOnWatchlist: true });
      }
    } catch (error) {
      console.error('Failed to add to watchlist:', error);
      toast.error('Failed to add to watchlist');
    }
  };

  return { isLoading, content, fetchTopicContent, setContent, addToWatchlist };
};
