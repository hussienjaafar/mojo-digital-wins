import { Card, CardContent } from "@/components/ui/card";
import { caseStudies } from "@/data/caseStudies";

interface Video {
  id: string;
  title: string;
  vimeoUrl: string;
  description: string;
}

// Filter case studies that have videos and transform them for the gallery
const videos: Video[] = caseStudies
  .filter((study) => study.video)
  .map((study) => ({
    id: study.id,
    title: study.title,
    vimeoUrl: study.video!,
    description: study.description,
  }));

const getVimeoId = (url: string) => {
  // Handle both player.vimeo.com and vimeo.com formats
  const playerMatch = url.match(/player\.vimeo\.com\/video\/(\d+)/);
  if (playerMatch) return playerMatch[1];
  
  const directMatch = url.match(/vimeo\.com\/(\d+)/);
  return directMatch ? directMatch[1] : null;
};

export const CreativeGallery = () => {
  return (
    <div className="grid md:grid-cols-2 gap-8">
      {videos.map((video, index) => {
        const vimeoId = getVimeoId(video.vimeoUrl);
        
        return (
          <Card
            key={video.id}
            className="overflow-hidden hover:shadow-xl transition-shadow duration-300 animate-bounce-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <CardContent className="p-0">
              <div className="aspect-video bg-muted flex items-center justify-center">
                {vimeoId ? (
                  <iframe
                    src={`https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0`}
                    className="w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={video.title}
                  />
                ) : (
                  <p className="text-muted-foreground">Add Vimeo link</p>
                )}
              </div>
              <div className="p-6">
                <h3 className="font-bebas text-2xl text-foreground mb-2 uppercase tracking-wide">
                  {video.title}
                </h3>
                <p className="text-sm text-muted-foreground">{video.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
