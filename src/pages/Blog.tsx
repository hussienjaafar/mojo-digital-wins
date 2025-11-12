import { useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import AnimatedPatternHero from "@/components/AnimatedPatternHero";
import ScrollProgressIndicator from "@/components/ScrollProgressIndicator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { blogPosts, blogCategories } from "@/data/blogPosts";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const Blog = () => {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const blogGrid = useScrollAnimation({ threshold: 0.1 });
  const categories = ["All", ...blogCategories];
  
  const filteredPosts = activeCategory === "All" 
    ? blogPosts 
    : blogPosts.filter(post => post.category === activeCategory);

  // JSON-LD structured data for SEO
  const blogSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Molitico Digital Strategy Blog",
    "description": "Expert insights on political campaign digital marketing, fundraising strategy, SMS campaigns, and progressive advocacy.",
    "url": "https://molitico.com/blog",
    "publisher": {
      "@type": "Organization",
      "name": "Molitico",
      "logo": {
        "@type": "ImageObject",
        "url": "https://molitico.com/logo.png"
      }
    },
    "blogPost": blogPosts.map(post => ({
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.metaDescription,
      "author": {
        "@type": "Organization",
        "name": post.author
      },
      "datePublished": post.publishDate,
      "url": `https://molitico.com/blog/${post.slug}`,
      "keywords": post.tags.join(", ")
    }))
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://molitico.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Blog",
        "item": "https://molitico.com/blog"
      }
    ]
  };

  return (
    <div className="min-h-screen">
      {/* SEO Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(blogSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>

      <ScrollProgressIndicator />
      <Navigation />
      
      <AnimatedPatternHero
        title="Digital Strategy Insights"
        description="Expert guidance on political campaign marketing, fundraising, and digital advocacy from campaigns that win."
      />

      {/* Category Filters */}
      <section className="py-8 bg-background border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-3 justify-center">
            {categories.map((category) => (
              <Button
                key={category}
                onClick={() => setActiveCategory(category)}
                variant={activeCategory === category ? "default" : "outline"}
                className="transition-all duration-300"
              >
                {category}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div 
            ref={blogGrid.ref}
            className={`grid md:grid-cols-2 lg:grid-cols-3 gap-8 transition-all duration-1000 ${
              blogGrid.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
          >
            {filteredPosts.map((post, index) => (
              <Card 
                key={post.id}
                className={`group hover:shadow-2xl transition-all duration-500 border border-border/50 bg-card backdrop-blur-sm hover:scale-[1.02] ${
                  blogGrid.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6 space-y-4">
                  {/* Category Badge */}
                  <div className="flex items-center justify-between">
                    <span className="inline-block px-3 py-1 text-xs font-semibold bg-secondary/20 text-secondary rounded-full">
                      {post.category}
                    </span>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{post.readTime} min read</span>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="font-bebas text-2xl text-foreground leading-tight group-hover:text-secondary transition-colors duration-300">
                    <Link to={`/blog/${post.slug}`}>
                      {post.title}
                    </Link>
                  </h2>

                  {/* Excerpt */}
                  <p className="text-muted-foreground leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>

                  {/* Meta Info */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-4 border-t border-border/50">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <time dateTime={post.publishDate}>
                        {new Date(post.publishDate).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </time>
                    </div>
                  </div>

                  {/* Read More Link */}
                  <Link 
                    to={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-2 text-secondary font-semibold group-hover:gap-3 transition-all duration-300"
                  >
                    Read Full Article
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-xl text-muted-foreground">
                No articles found in this category.
              </p>
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Blog;
