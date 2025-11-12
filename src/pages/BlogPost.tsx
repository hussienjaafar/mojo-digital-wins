import { useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Calendar, Clock, ArrowLeft, Tag } from "lucide-react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import ScrollProgressIndicator from "@/components/ScrollProgressIndicator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { blogPosts } from "@/data/blogPosts";
import { ParticleButton } from "@/components/ParticleButton";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find(p => p.slug === slug);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  // Related posts (same category, excluding current)
  const relatedPosts = blogPosts
    .filter(p => p.category === post.category && p.id !== post.id)
    .slice(0, 3);

  // JSON-LD structured data for SEO
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.metaDescription,
    "image": post.image || "https://molitico.com/og-image.png",
    "author": {
      "@type": "Organization",
      "name": post.author
    },
    "publisher": {
      "@type": "Organization",
      "name": "Molitico",
      "logo": {
        "@type": "ImageObject",
        "url": "https://molitico.com/logo.png"
      }
    },
    "datePublished": post.publishDate,
    "dateModified": post.publishDate,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://molitico.com/blog/${post.slug}`
    },
    "keywords": post.tags.join(", "),
    "articleSection": post.category,
    "wordCount": post.content.split(/\s+/).length
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
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": post.title,
        "item": `https://molitico.com/blog/${post.slug}`
      }
    ]
  };

  return (
    <div className="min-h-screen">
      {/* SEO Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(articleSchema)}
      </script>
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>

      {/* Meta Tags */}
      <title>{post.title} | Molitico</title>
      <meta name="description" content={post.metaDescription} />
      <meta name="keywords" content={post.tags.join(", ")} />
      <meta property="og:title" content={post.title} />
      <meta property="og:description" content={post.metaDescription} />
      <meta property="og:type" content="article" />
      <meta property="article:published_time" content={post.publishDate} />
      <meta property="article:author" content={post.author} />
      <meta property="article:section" content={post.category} />
      {post.tags.map(tag => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}

      <ScrollProgressIndicator />
      <Navigation />

      {/* Breadcrumb Navigation */}
      <nav className="bg-muted/30 border-b border-border py-4 mt-20">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <span>/</span>
            <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>
            <span>/</span>
            <span className="text-foreground">{post.title}</span>
          </div>
        </div>
      </nav>

      {/* Article Header */}
      <article className="py-12 sm:py-16 md:py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Back Button */}
          <Link to="/blog">
            <Button variant="ghost" className="mb-6 group">
              <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
              Back to Blog
            </Button>
          </Link>

          {/* Category Badge */}
          <span className="inline-block px-4 py-1.5 text-sm font-semibold bg-secondary/20 text-secondary rounded-full mb-6">
            {post.category}
          </span>

          {/* Title */}
          <h1 className="font-bebas text-4xl sm:text-5xl md:text-6xl text-foreground leading-tight mb-6">
            {post.title}
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-6 text-muted-foreground mb-8 pb-8 border-b border-border">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              <time dateTime={post.publishDate}>
                {new Date(post.publishDate).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </time>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>{post.readTime} minute read</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">By {post.author}</span>
            </div>
          </div>

          {/* Article Content */}
          <div 
            className="prose prose-lg prose-slate dark:prose-invert max-w-none
              prose-headings:font-bebas prose-headings:tracking-wide
              prose-h1:text-4xl prose-h1:mb-6 prose-h1:mt-12
              prose-h2:text-3xl prose-h2:mb-4 prose-h2:mt-10
              prose-h3:text-2xl prose-h3:mb-3 prose-h3:mt-8
              prose-p:leading-relaxed prose-p:mb-6
              prose-a:text-secondary prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground prose-strong:font-semibold
              prose-ul:my-6 prose-ul:list-disc prose-ul:pl-6
              prose-ol:my-6 prose-ol:list-decimal prose-ol:pl-6
              prose-li:mb-2 prose-li:leading-relaxed
              prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-blockquote:border-l-4 prose-blockquote:border-secondary 
              prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:my-6"
            dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br />') }}
          />

          {/* Tags */}
          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex items-center gap-3 flex-wrap">
              <Tag className="w-5 h-5 text-muted-foreground" />
              {post.tags.map(tag => (
                <span 
                  key={tag}
                  className="px-3 py-1 bg-muted text-muted-foreground text-sm rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </article>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-primary via-primary/95 to-primary/90 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="font-bebas text-3xl sm:text-4xl md:text-5xl text-primary-foreground mb-4">
            Ready to Build Your Winning Strategy?
          </h2>
          <p className="text-lg text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Let's discuss how our proven digital strategies can help your campaign, PAC, or nonprofit achieve extraordinary results.
          </p>
          <ParticleButton
            href="https://calendly.com/molitico/30min"
            size="lg"
            variant="default"
            particleColor="hsl(var(--accent))"
            particleCount={25}
            className="font-bold"
          >
            Book Free Strategy Call
          </ParticleButton>
        </div>
      </section>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-16 bg-background">
          <div className="container mx-auto px-4">
            <h2 className="font-bebas text-3xl sm:text-4xl text-foreground mb-8 text-center">
              Related Articles
            </h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {relatedPosts.map(relatedPost => (
                <Card 
                  key={relatedPost.id}
                  className="group hover:shadow-xl transition-all duration-300 border border-border/50 bg-card backdrop-blur-sm hover:scale-[1.02]"
                >
                  <CardContent className="p-6 space-y-4">
                    <span className="inline-block px-3 py-1 text-xs font-semibold bg-secondary/20 text-secondary rounded-full">
                      {relatedPost.category}
                    </span>
                    <h3 className="font-bebas text-xl text-foreground leading-tight group-hover:text-secondary transition-colors">
                      <Link to={`/blog/${relatedPost.slug}`}>
                        {relatedPost.title}
                      </Link>
                    </h3>
                    <p className="text-muted-foreground text-sm line-clamp-3">
                      {relatedPost.excerpt}
                    </p>
                    <Link 
                      to={`/blog/${relatedPost.slug}`}
                      className="inline-flex items-center gap-2 text-secondary font-semibold text-sm group-hover:gap-3 transition-all"
                    >
                      Read Article
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default BlogPost;
