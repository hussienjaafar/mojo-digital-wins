import { NewsFeed } from "@/components/news/NewsFeed";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

const News = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 py-8">
        <NewsFeed />
      </main>
      <Footer />
    </div>
  );
};

export default News;
