import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  aspectRatio?: "video" | "square" | "portrait" | "auto";
  placeholderClassName?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function LazyImage({
  src,
  alt,
  className,
  aspectRatio = "auto",
  placeholderClassName,
  onLoad,
  onError,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const aspectRatioClasses = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
    auto: ""
  };

  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "50px", // Start loading 50px before image enters viewport
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <div 
      ref={imgRef} 
      className={cn(
        "relative overflow-hidden bg-muted",
        aspectRatioClasses[aspectRatio],
        placeholderClassName
      )}
    >
      {!isLoaded && !hasError && (
        <Skeleton className="absolute inset-0" />
      )}
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <p className="text-sm text-muted-foreground">Failed to load image</p>
        </div>
      )}
      
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          {...props}
        />
      )}
    </div>
  );
}

// Optimized image with blur-up effect
interface OptimizedImageProps extends LazyImageProps {
  lowQualitySrc?: string;
}

export function OptimizedImage({
  lowQualitySrc,
  ...props
}: OptimizedImageProps) {
  const [showLowQuality, setShowLowQuality] = useState(!!lowQualitySrc);

  return (
    <div className="relative">
      {showLowQuality && lowQualitySrc && (
        <img
          src={lowQualitySrc}
          alt={props.alt}
          className={cn("absolute inset-0 blur-sm", props.className)}
          aria-hidden="true"
        />
      )}
      <LazyImage
        {...props}
        onLoad={() => {
          setShowLowQuality(false);
          props.onLoad?.();
        }}
      />
    </div>
  );
}
