import { useEffect, useMemo } from "react";
import { Helmet } from "react-helmet";
import { useParams, Link, Navigate } from "react-router-dom";
import { Calendar, Clock, ArrowLeft, Tag, ArrowRight, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { blogPosts } from "@/data/blogPosts";
import { ParticleButton } from "@/components/ParticleButton";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { AuthorBio } from "@/components/blog/AuthorBio";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { ReadingProgress } from "@/components/blog/ReadingProgress";
import { LazyImage } from "@/components/LazyImage";

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = blogPosts.find(p => p.slug === slug);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // Custom markdown components
  const markdownComponents: Components = useMemo(() => ({
    h2: ({ children }) => {
      const id = String(children)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
      return (
        <h2 id={id} className="scroll-mt-28 font-bebas text-3xl md:text-4xl text-foreground mt-16 mb-6 pb-3 border-b border-border/50">
          {children}
        </h2>
      );
    },
    h3: ({ children }) => {
      const id = String(children)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
      return (
        <h3 id={id} className="scroll-mt-28 font-bebas text-2xl md:text-3xl text-foreground mt-10 mb-4">
          {children}
        </h3>
      );
    },
    p: ({ children }) => (
      <p className="text-lg leading-[1.8] text-foreground/90 mb-6">
        {children}
      </p>
    ),
    a: ({ href, children }) => {
      const isInternal = href?.startsWith("/");
      const isAnchor = href?.startsWith("#");
      
      if (isInternal) {
        return (
          <Link 
            to={href} 
            className="text-secondary font-medium underline underline-offset-4 decoration-secondary/40 hover:decoration-secondary transition-colors"
          >
            {children}
          </Link>
        );
      }
      
      if (isAnchor) {
        return (
          <a href={href} className="text-secondary font-medium hover:underline">
            {children}
          </a>
        );
      }
      
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-secondary font-medium underline underline-offset-4 decoration-secondary/40 hover:decoration-secondary transition-colors"
        >
          {children}
          <span className="inline-block ml-1 text-xs">↗</span>
        </a>
      );
    },
    ul: ({ children }) => (
      <ul className="my-6 ml-2 space-y-3">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-6 ml-2 space-y-3 list-decimal list-inside">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-lg leading-relaxed text-foreground/90 flex items-start gap-3">
        <span className="mt-2 w-2 h-2 rounded-full bg-secondary shrink-0" />
        <span className="flex-1">{children}</span>
      </li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-10 px-8 py-6 relative border-none bg-muted/30 rounded-xl">
        <span className="absolute -top-3 left-6 text-6xl font-serif text-secondary/30 leading-none select-none">
          "
        </span>
        <div className="relative z-10 text-xl italic text-foreground/90 leading-relaxed">
          {children}
        </div>
      </blockquote>
    ),
    strong: ({ children }) => (
      <strong className="font-bold text-foreground">
        {children}
      </strong>
    ),
    table: ({ children }) => (
      <div className="my-8 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-muted/50 border-b border-border">
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th className="px-4 py-3 text-left font-semibold text-foreground">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-foreground/80 border-b border-border/50">
        {children}
      </td>
    ),
    code: ({ children }) => (
      <code className="px-2 py-1 rounded-md bg-muted text-sm font-mono text-foreground">
        {children}
      </code>
    ),
    hr: () => (
      <hr className="my-12 border-none h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    ),
  }), []);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  // Related posts (same category, excluding current)
  const relatedPosts = blogPosts
    .filter(p => p.category === post.category && p.id !== post.id)
    .slice(0, 3);

  // Calculate word count and reading time
  const wordCount = post.content.split(/\s+/).length;

  // Default hero images by category
  const categoryHeroImages: Record<string, string> = {
    "Fundraising": "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=1920&h=800&fit=crop",
    "Campaign Strategy": "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1920&h=800&fit=crop",
    "Digital Advertising": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&h=800&fit=crop",
    "GOTV": "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=1920&h=800&fit=crop",
    "Nonprofit Strategy": "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1920&h=800&fit=crop",
  };

  const heroImage = post.heroImage || categoryHeroImages[post.category] || "https://images.unsplash.com/photo-1551836022-b06985bceb24?w=1920&h=800&fit=crop";

  // JSON-LD structured data for SEO
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.metaDescription,
    "image": heroImage,
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
    "wordCount": wordCount
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

  const currentUrl = `https://molitico.com/blog/${post.slug}`;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{post.title} | Molitico</title>
        <meta name="description" content={post.metaDescription} />
        <meta name="keywords" content={post.tags.join(", ")} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.metaDescription} />
        <meta property="og:image" content={heroImage} />
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content={post.publishDate} />
        <meta property="article:author" content={post.author} />
        <meta property="article:section" content={post.category} />
        {post.tags.map(tag => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}
        
        <script type="application/ld+json">
          {JSON.stringify(articleSchema)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbSchema)}
        </script>
      </Helmet>

      <ReadingProgress />
      <Navigation />

      {/* Hero Section */}
      <header className="relative mt-20 overflow-hidden">
        {/* Hero Image */}
        <div className="absolute inset-0">
          <LazyImage
            src={heroImage}
            alt={post.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/80 to-primary/40" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 container mx-auto px-4 py-16 md:py-24 lg:py-32">
          {/* Breadcrumb */}
          <nav className="mb-8">
            <div className="flex items-center gap-2 text-sm text-primary-foreground/70">
              <Link to="/" className="hover:text-primary-foreground transition-colors">Home</Link>
              <span>/</span>
              <Link to="/blog" className="hover:text-primary-foreground transition-colors">Blog</Link>
              <span>/</span>
              <span className="text-primary-foreground truncate max-w-[200px]">{post.title}</span>
            </div>
          </nav>

          {/* Category Badge */}
          <span className="inline-block px-4 py-1.5 text-sm font-bold bg-secondary text-secondary-foreground rounded-full mb-6">
            {post.category}
          </span>

          {/* Title */}
          <h1 className="font-bebas text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-primary-foreground leading-[1.1] mb-8 max-w-4xl" style={{ textWrap: 'balance' } as React.CSSProperties}>
            {post.title}
          </h1>

          {/* Meta Info Card */}
          <div className="flex flex-wrap items-center gap-6 text-primary-foreground/90">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <span className="font-medium">{post.author}</span>
            </div>
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
              <span>{post.readTime} min read</span>
            </div>
            <ShareButtons title={post.title} url={currentUrl} className="ml-auto" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <article className="py-12 md:py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <div className="flex gap-12 max-w-7xl mx-auto">
            {/* Table of Contents - Desktop */}
            <TableOfContents content={post.content} />

            {/* Article Content */}
            <div className="flex-1 max-w-3xl mx-auto lg:mx-0">
              {/* Content */}
              <div className="article-content">
                <ReactMarkdown components={markdownComponents}>
                  {post.content}
                </ReactMarkdown>
              </div>

              {/* Tags */}
              <div className="mt-12 pt-8 border-t border-border">
                <div className="flex items-center gap-3 flex-wrap">
                  <Tag className="w-5 h-5 text-muted-foreground" />
                  {post.tags.map(tag => (
                    <span 
                      key={tag}
                      className="px-3 py-1.5 bg-muted text-muted-foreground text-sm rounded-full hover:bg-muted/80 transition-colors"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Author Bio */}
              <AuthorBio author={post.author} />
            </div>
          </div>
        </div>
      </article>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary via-primary/95 to-primary/90 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_40%)]" />
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="font-bebas text-4xl sm:text-5xl md:text-6xl text-primary-foreground mb-6">
            Ready to Build Your Winning Strategy?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-10 max-w-2xl mx-auto leading-relaxed">
            Let's discuss how our proven digital strategies can help your campaign, PAC, or nonprofit achieve extraordinary results.
          </p>
          <ParticleButton
            href="https://calendly.com/molitico/30min"
            size="lg"
            variant="default"
            particleColor="hsl(var(--accent))"
            particleCount={25}
            className="font-bold text-lg px-10 py-6"
          >
            Book Free Strategy Call
          </ParticleButton>
        </div>
      </section>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-sm font-bold text-secondary uppercase tracking-wider">Keep Reading</span>
              <h2 className="font-bebas text-4xl sm:text-5xl text-foreground mt-2">
                Related Articles
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {relatedPosts.map(relatedPost => {
                const relatedHeroImage = relatedPost.heroImage || categoryHeroImages[relatedPost.category] || "https://images.unsplash.com/photo-1551836022-b06985bceb24?w=800&h=400&fit=crop";
                
                return (
                  <Card 
                    key={relatedPost.id}
                    className="group overflow-hidden hover:shadow-xl transition-all duration-300 border border-border/50 bg-card hover:scale-[1.02]"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-[16/10] overflow-hidden">
                      <LazyImage
                        src={relatedHeroImage}
                        alt={relatedPost.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <CardContent className="p-6 space-y-4">
                      <span className="inline-block px-3 py-1 text-xs font-bold bg-secondary/20 text-secondary rounded-full">
                        {relatedPost.category}
                      </span>
                      <h3 className="font-bebas text-xl text-foreground leading-tight group-hover:text-secondary transition-colors line-clamp-2">
                        <Link to={`/blog/${relatedPost.slug}`}>
                          {relatedPost.title}
                        </Link>
                      </h3>
                      <p className="text-muted-foreground text-sm line-clamp-2">
                        {relatedPost.excerpt}
                      </p>
                      <Link 
                        to={`/blog/${relatedPost.slug}`}
                        className="inline-flex items-center gap-2 text-secondary font-semibold text-sm group-hover:gap-3 transition-all"
                      >
                        Read Article
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Back to Blog */}
            <div className="text-center mt-12">
              <Link to="/blog">
                <Button variant="outline" size="lg" className="group">
                  <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                  View All Articles
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
};

export default BlogPost;
