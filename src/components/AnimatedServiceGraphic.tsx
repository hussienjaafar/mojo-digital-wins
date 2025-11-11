type AnimatedServiceGraphicProps = {
  variant: "hexagons" | "network" | "triangles";
};

const AnimatedServiceGraphic = ({ variant }: AnimatedServiceGraphicProps) => {
  if (variant === "hexagons") {
    return (
      <div className="aspect-square rounded-xl overflow-hidden relative bg-gradient-to-br from-secondary/10 to-accent/10 shadow-lg">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Hexagon 1 - Largest */}
          <polygon
            points="100,20 160,55 160,125 100,160 40,125 40,55"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="1.5"
            opacity="0.6"
            className="animate-[spin_20s_linear_infinite]"
            style={{ transformOrigin: "100px 100px" }}
          />
          
          {/* Hexagon 2 - Medium */}
          <polygon
            points="100,40 140,65 140,115 100,140 60,115 60,65"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="1.5"
            opacity="0.7"
            className="animate-[spin_15s_linear_infinite_reverse]"
            style={{ transformOrigin: "100px 100px" }}
          />
          
          {/* Hexagon 3 - Small */}
          <polygon
            points="100,60 120,75 120,105 100,120 80,105 80,75"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="2"
            opacity="0.8"
            className="animate-[spin_10s_linear_infinite]"
            style={{ transformOrigin: "100px 100px" }}
          />
          
          {/* Center pulsing circle */}
          <circle
            cx="100"
            cy="90"
            r="8"
            fill="hsl(var(--accent))"
            opacity="0.5"
            className="animate-[pulse_2s_ease-in-out_infinite]"
          />
          
          {/* Animated drawing path effect */}
          <polygon
            points="100,30 150,60 150,120 100,150 50,120 50,60"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="1"
            opacity="0.4"
            strokeDasharray="400"
            strokeDashoffset="400"
            className="animate-[draw-path_8s_ease-in-out_infinite]"
            style={{ transformOrigin: "100px 100px" }}
          />
        </svg>
      </div>
    );
  }

  if (variant === "network") {
    return (
      <div className="aspect-square rounded-xl overflow-hidden relative bg-gradient-to-br from-destructive/10 to-secondary/10 shadow-lg">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Connection lines */}
          <line
            x1="50"
            y1="50"
            x2="150"
            y2="50"
            stroke="hsl(var(--destructive))"
            strokeWidth="1"
            opacity="0.3"
            strokeDasharray="100"
            strokeDashoffset="100"
            className="animate-[draw-path_4s_ease-in-out_infinite]"
          />
          <line
            x1="150"
            y1="50"
            x2="150"
            y2="150"
            stroke="hsl(var(--secondary))"
            strokeWidth="1"
            opacity="0.3"
            strokeDasharray="100"
            strokeDashoffset="100"
            className="animate-[draw-path_4s_ease-in-out_infinite_0.5s]"
            style={{ animationDelay: "0.5s" }}
          />
          <line
            x1="150"
            y1="150"
            x2="50"
            y2="150"
            stroke="hsl(var(--destructive))"
            strokeWidth="1"
            opacity="0.3"
            strokeDasharray="100"
            strokeDashoffset="100"
            className="animate-[draw-path_4s_ease-in-out_infinite_1s]"
            style={{ animationDelay: "1s" }}
          />
          <line
            x1="50"
            y1="150"
            x2="50"
            y2="50"
            stroke="hsl(var(--secondary))"
            strokeWidth="1"
            opacity="0.3"
            strokeDasharray="100"
            strokeDashoffset="100"
            className="animate-[draw-path_4s_ease-in-out_infinite_1.5s]"
            style={{ animationDelay: "1.5s" }}
          />
          
          {/* Diagonal connections */}
          <line
            x1="50"
            y1="50"
            x2="150"
            y2="150"
            stroke="hsl(var(--destructive))"
            strokeWidth="1"
            opacity="0.2"
            strokeDasharray="150"
            strokeDashoffset="150"
            className="animate-[draw-path_5s_ease-in-out_infinite]"
          />
          <line
            x1="150"
            y1="50"
            x2="50"
            y2="150"
            stroke="hsl(var(--secondary))"
            strokeWidth="1"
            opacity="0.2"
            strokeDasharray="150"
            strokeDashoffset="150"
            className="animate-[draw-path_5s_ease-in-out_infinite_0.5s]"
            style={{ animationDelay: "0.5s" }}
          />
          
          {/* Network nodes */}
          {[
            { cx: 50, cy: 50, delay: 0 },
            { cx: 150, cy: 50, delay: 0.5 },
            { cx: 150, cy: 150, delay: 1 },
            { cx: 50, cy: 150, delay: 1.5 },
            { cx: 100, cy: 100, delay: 0.75 }
          ].map((node, i) => (
            <circle
              key={i}
              cx={node.cx}
              cy={node.cy}
              r="6"
              fill="hsl(var(--accent))"
              opacity="0.7"
              className="animate-[pulse_2s_ease-in-out_infinite]"
              style={{ animationDelay: `${node.delay}s` }}
            />
          ))}
          
          {/* Additional floating nodes */}
          {[
            { cx: 75, cy: 75, r: 4 },
            { cx: 125, cy: 75, r: 4 },
            { cx: 125, cy: 125, r: 4 },
            { cx: 75, cy: 125, r: 4 }
          ].map((node, i) => (
            <circle
              key={`small-${i}`}
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              fill="hsl(var(--secondary))"
              opacity="0.5"
              className="animate-[float_3s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </svg>
      </div>
    );
  }

  if (variant === "triangles") {
    return (
      <div className="aspect-square rounded-xl overflow-hidden relative bg-gradient-to-br from-accent/10 to-primary/10 shadow-lg">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Large background triangle */}
          <polygon
            points="100,30 170,150 30,150"
            fill="hsl(var(--accent))"
            opacity="0.1"
            className="animate-[float_6s_ease-in-out_infinite]"
          />
          
          {/* Medium triangle with stroke */}
          <polygon
            points="100,50 150,130 50,130"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            opacity="0.4"
            strokeDasharray="300"
            strokeDashoffset="300"
            className="animate-[draw-path_6s_ease-in-out_infinite]"
          />
          
          {/* Upward arrow triangle 1 */}
          <polygon
            points="100,80 120,110 80,110"
            fill="hsl(var(--accent))"
            opacity="0.6"
            className="animate-[float_4s_ease-in-out_infinite]"
            style={{ animationDelay: "0s" }}
          />
          
          {/* Upward arrow triangle 2 */}
          <polygon
            points="100,100 120,130 80,130"
            fill="hsl(var(--primary))"
            opacity="0.5"
            className="animate-[float_4s_ease-in-out_infinite]"
            style={{ animationDelay: "0.5s" }}
          />
          
          {/* Upward arrow triangle 3 */}
          <polygon
            points="100,120 120,150 80,150"
            fill="hsl(var(--accent))"
            opacity="0.4"
            className="animate-[float_4s_ease-in-out_infinite]"
            style={{ animationDelay: "1s" }}
          />
          
          {/* Inverted triangle for depth */}
          <polygon
            points="100,140 70,90 130,90"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="1.5"
            opacity="0.3"
            className="animate-[spin_12s_linear_infinite]"
            style={{ transformOrigin: "100px 110px" }}
          />
          
          {/* Small accent triangles */}
          <polygon
            points="60,60 70,80 50,80"
            fill="hsl(var(--primary))"
            opacity="0.4"
            className="animate-[pulse_3s_ease-in-out_infinite]"
          />
          <polygon
            points="140,60 150,80 130,80"
            fill="hsl(var(--accent))"
            opacity="0.4"
            className="animate-[pulse_3s_ease-in-out_infinite]"
            style={{ animationDelay: "0.5s" }}
          />
        </svg>
      </div>
    );
  }

  return null;
};

export default AnimatedServiceGraphic;
