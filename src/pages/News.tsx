import { NewsFeed } from "@/components/news/NewsFeed";
import { SentimentDashboard } from "@/components/news/SentimentDashboard";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Newspaper, BarChart3 } from "lucide-react";

const News = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Tabs defaultValue="news" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="news" className="flex items-center gap-2">
              <Newspaper className="w-4 h-4" />
              News Feed
            </TabsTrigger>
            <TabsTrigger value="sentiment" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Sentiment Analysis
            </TabsTrigger>
          </TabsList>

          <TabsContent value="news">
            <NewsFeed />
          </TabsContent>

          <TabsContent value="sentiment">
            <SentimentDashboard />
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default News;
