import { Card, CardContent } from "@/components/ui/card";

interface Video {
  id: string;
  title: string;
  vimeoUrl: string;
  description: string;
}

// Placeholder data - will be updated with actual Vimeo links
const videos: Video[] = [
  {
    id: "1",
    title: "Campaign Video 1",
    vimeoUrl: "https://vimeo.com/YOUR_VIDEO_ID_HERE",
    description: "Replace with actual Vimeo link",
  },
  // Add more videos here once you have the Vimeo links
];

const getVimeoId = (url: string) => {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
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
