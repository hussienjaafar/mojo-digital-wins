import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NewsCard } from "@/components/news/NewsCard";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingCard } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Bookmark, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    if (user) {
      fetchBookmarks(user.id);
    } else {
      setLoading(false);
    }
  };

  const fetchBookmarks = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('article_bookmarks')
        .select(`
          id,
          created_at,
          notes,
          article:articles (*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Extract articles from bookmarks
      const articles = data?.map(bookmark => ({
        ...bookmark.article,
        bookmarked_at: bookmark.created_at,
        bookmark_notes: bookmark.notes
      })) || [];

      setBookmarks(articles);
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Bookmark className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Sign In Required</h2>
          <p className="text-muted-foreground mb-6">
            Please sign in to view your bookmarked articles
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild variant="outline">
              <Link to="/admin">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <Button asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 portal-animate-fade-in">
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/admin">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <Bookmark className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold portal-text-primary">My Bookmarks</h1>
            <p className="portal-text-secondary">
              <span className="font-semibold portal-text-primary">{bookmarks.length}</span> saved {bookmarks.length === 1 ? 'article' : 'articles'}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
          <LoadingCard />
        ) : bookmarks.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bookmark className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold mb-2">No bookmarks yet</h2>
              <p className="text-muted-foreground mb-6">
                Start bookmarking articles to build your reading list
              </p>
              <Button asChild>
                <Link to="/admin?tab=news">Browse Articles</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookmarks.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        )}
    </div>
  );
}
