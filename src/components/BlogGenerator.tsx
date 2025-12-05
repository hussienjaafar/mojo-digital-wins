import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, Copy, Download } from "lucide-react";

export const BlogGenerator = () => {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{
    title: string;
    excerpt: string;
    content: string;
    keywords: string[];
  } | null>(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast({
        title: "Topic required",
        description: "Please enter a topic for your blog post",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to generate blog posts",
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-blog-post', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          topic: topic.trim(),
          keywords: keywords.split(',').map(k => k.trim()).filter(k => k),
          tone,
          length,
        }
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedContent(data);
      toast({
        title: "Blog post generated!",
        description: "Review and edit the content below",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: "Failed to generate blog post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (generatedContent) {
      navigator.clipboard.writeText(generatedContent.content);
      toast({
        title: "Copied to clipboard",
        description: "Blog post content copied successfully",
      });
    }
  };

  const handleDownload = () => {
    if (generatedContent) {
      const blob = new Blob([generatedContent.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generatedContent.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Downloaded",
        description: "Blog post saved as markdown file",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="topic">Blog Post Topic *</Label>
            <Input
              id="topic"
              placeholder="e.g., SMS Fundraising Strategies for 2025"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div>
            <Label htmlFor="keywords">Keywords (comma-separated)</Label>
            <Input
              id="keywords"
              placeholder="e.g., SMS fundraising, political campaigns, digital strategy"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tone">Tone</Label>
              <Select value={tone} onValueChange={setTone} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="conversational">Conversational</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="inspirational">Inspirational</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="length">Length</Label>
              <Select value={length} onValueChange={setLength} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short (500-700 words)</SelectItem>
                  <SelectItem value="medium">Medium (800-1200 words)</SelectItem>
                  <SelectItem value="long">Long (1500-2000 words)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Blog Post
              </>
            )}
          </Button>
        </div>
      </Card>

      {generatedContent && (
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Generated Content</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>

            <div>
              <Label>Title</Label>
              <div className="p-3 bg-muted rounded-md mt-1">
                {generatedContent.title}
              </div>
            </div>

            <div>
              <Label>Excerpt</Label>
              <div className="p-3 bg-muted rounded-md mt-1">
                {generatedContent.excerpt}
              </div>
            </div>

            <div>
              <Label>Keywords</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {generatedContent.keywords.map((keyword, idx) => (
                  <span key={idx} className="px-2 py-1 bg-primary/10 text-primary rounded-md text-sm">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <Label>Content</Label>
              <Textarea
                value={generatedContent.content}
                onChange={(e) => setGeneratedContent({...generatedContent, content: e.target.value})}
                className="min-h-[400px] font-mono text-sm mt-1"
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
