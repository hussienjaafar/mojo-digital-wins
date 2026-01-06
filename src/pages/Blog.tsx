import { useState } from "react";
import { Helmet } from "react-helmet";
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
import { LazyImage } from "@/components/LazyImage";

// Category hero images - abstract, professional, politically neutral
const categoryHeroImages: Record<string, string> = {
  "Fundraising": "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=400&fit=crop",
  "Campaign Strategy": "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&h=400&fit=crop",
  "Digital Advertising": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop",
  "GOTV": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&h=400&fit=crop",
  "Nonprofit Strategy": "https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=400&fit=crop",
};

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
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Political Digital Strategy Blog | Molitico Insights</title>
        <meta name="description" content="Expert insights on political campaign marketing, SMS fundraising, digital advertising, and progressive advocacy strategies." />
        <link rel="canonical" href="https://molitico.com/blog" />
        <meta property="og:title" content="Political Digital Strategy Blog | Molitico Insights" />
        <meta property="og:description" content="Expert insights on political campaign marketing, SMS fundraising, digital advertising, and progressive advocacy strategies." />
        <meta property="og:url" content="https://molitico.com/blog" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify(blogSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      </Helmet>

      <ScrollProgressIndicator />
      <Navigation />
      
      <AnimatedPatternHero
        title="Political Digital Strategy Insights"
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
            {filteredPosts.map((post, index) => {
              const postImage = post.heroImage || categoryHeroImages[post.category] || "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&h=400&fit=crop";
              
              return (
                <Card 
                  key={post.id}
                  className={`group overflow-hidden hover:shadow-xl transition-all duration-500 border border-border bg-card hover:scale-[1.02] ${
                    blogGrid.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                  }`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  {/* Thumbnail Image */}
                  <div className="aspect-[16/10] overflow-hidden bg-muted">
                    <LazyImage
                      src={postImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  
                  <CardContent className="p-6 space-y-4">
                    {/* Category Badge */}
                    <div className="flex items-center justify-between">
                      <span className="inline-block px-3 py-1 text-xs font-bold bg-secondary/20 text-secondary rounded-full">
                        {post.category}
                      </span>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{post.readTime} min</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="font-bebas text-2xl text-foreground leading-tight group-hover:text-secondary transition-colors duration-300 line-clamp-2">
                      <Link to={`/blog/${post.slug}`}>
                        {post.title}
                      </Link>
                    </h2>

                    {/* Excerpt */}
                    <p className="text-muted-foreground leading-relaxed line-clamp-2 text-sm">
                      {post.excerpt}
                    </p>

                    {/* Meta Info */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <time dateTime={post.publishDate}>
                          {new Date(post.publishDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </time>
                      </div>

                      {/* Read More Link */}
                      <Link 
                        to={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-2 text-secondary font-semibold text-sm group-hover:gap-3 transition-all duration-300"
                      >
                        Read
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
