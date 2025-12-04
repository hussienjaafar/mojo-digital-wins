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

export interface TopicContentResult {
  topic: string;
  articles: TopicArticle[];
  socialPosts: TopicArticle[];
  totalCount: number;
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
            .select('id, title, description, source_url, source_name, published_date, sentiment_label')
            .in('id', trendingData[0].article_ids)
            .order('published_date', { ascending: false })
            .limit(15);

          if (articles) {
            results.push(...articles.map(a => ({ ...a, type: 'news' as const })));
          }
        }

        // Also search articles by topic in extracted_topics or title
        if (results.length < 5) {
          const { data: searchArticles } = await supabase
            .from('articles')
            .select('id, title, description, source_url, source_name, published_date, sentiment_label')
            .or(`title.ilike.%${topic}%,description.ilike.%${topic}%`)
            .order('published_date', { ascending: false })
            .limit(10);

          if (searchArticles) {
            const existingIds = new Set(results.map(r => r.id));
            const newArticles = searchArticles.filter(a => !existingIds.has(a.id));
            results.push(...newArticles.map(a => ({ ...a, type: 'news' as const })));
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

      setContent({
        topic,
        articles: results.slice(0, 15),
        socialPosts: socialResults.slice(0, 15),
        totalCount: results.length + socialResults.length
      });

    } catch (error: any) {
      console.error('Error fetching topic content:', error);
      toast.error('Failed to load topic content');
      setContent({ topic, articles: [], socialPosts: [], totalCount: 0 });
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, content, fetchTopicContent, setContent };
};
