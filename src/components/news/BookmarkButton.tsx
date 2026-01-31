import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BookmarkButtonProps {
  articleId: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost";
}

export function BookmarkButton({ articleId, size = "sm", variant = "ghost" }: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkBookmarkStatus();
  }, [articleId]);

  const checkBookmarkStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('article_bookmarks')
        .select('id')
        .eq('article_id', articleId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setIsBookmarked(!!data);
    } catch (error) {
      console.error('Error checking bookmark status:', error);
    }
  };

  const toggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to bookmark articles",
          variant: "destructive",
        });
        return;
      }

      if (isBookmarked) {
        // Remove bookmark
        const { error } = await supabase
          .from('article_bookmarks')
          .delete()
          .eq('article_id', articleId)
          .eq('user_id', user.id);

        if (error) throw error;

        setIsBookmarked(false);
        toast({
          title: "Bookmark removed",
          description: "Article removed from your bookmarks",
        });
      } else {
        // Add bookmark
        const { error } = await supabase
          .from('article_bookmarks')
          .insert({
            article_id: articleId,
            user_id: user.id,
          });

        if (error) throw error;

        setIsBookmarked(true);
        toast({
          title: "Bookmarked",
          description: "Article added to your bookmarks",
        });
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast({
        title: "Error",
        description: "Failed to update bookmark",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={toggleBookmark}
      disabled={loading}
      className="transition-colors"
    >
      {isBookmarked ? (
        <BookmarkCheck className="w-4 h-4 fill-current" />
      ) : (
        <Bookmark className="w-4 h-4" />
      )}
    </Button>
  );
}
