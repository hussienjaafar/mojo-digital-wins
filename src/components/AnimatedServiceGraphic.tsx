type AnimatedServiceGraphicProps = {
  variant: "megaphone" | "messageBubbles" | "envelope";
};

const AnimatedServiceGraphic = ({ variant }: AnimatedServiceGraphicProps) => {
  if (variant === "megaphone") {
    return (
      <div className="aspect-square rounded-xl overflow-hidden relative bg-gradient-to-br from-secondary/10 to-accent/10 shadow-lg">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background gradient */}
          <defs>
            <linearGradient id="megaphoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="[stop-color:hsl(var(--secondary))]" stopOpacity="0.3" />
              <stop offset="100%" className="[stop-color:hsl(var(--accent))]" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Expanding sound wave circles */}
          <circle
            cx="120"
            cy="100"
            r="20"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="2"
            opacity="0.6"
            className="animate-[ping_3s_ease-out_infinite]"
          />
          <circle
            cx="120"
            cy="100"
            r="20"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="2"
            opacity="0.4"
            className="animate-[ping_3s_ease-out_infinite_1s]"
          />
          <circle
            cx="120"
            cy="100"
            r="20"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="2"
            opacity="0.2"
            className="animate-[ping_3s_ease-out_infinite_2s]"
          />

          {/* Megaphone body */}
          <g className="animate-[pulse_4s_ease-in-out_infinite]">
            {/* Main megaphone shape */}
            <path
              d="M 60 100 L 100 80 L 100 120 Z"
              fill="url(#megaphoneGrad)"
              stroke="hsl(var(--secondary))"
              strokeWidth="2.5"
              className="[stroke-dasharray:200] [stroke-dashoffset:200] animate-[draw-path_2s_ease-out_forwards]"
            />
            {/* Megaphone cone */}
            <path
              d="M 100 80 L 140 70 L 140 130 L 100 120 Z"
              fill="none"
              stroke="hsl(var(--accent))"
              strokeWidth="2.5"
              className="[stroke-dasharray:300] [stroke-dashoffset:300] animate-[draw-path_2.5s_ease-out_forwards_0.3s]"
            />
            {/* Handle */}
            <path
              d="M 70 120 Q 65 130 70 140"
              fill="none"
              stroke="hsl(var(--secondary))"
              strokeWidth="2"
              className="[stroke-dasharray:50] [stroke-dashoffset:50] animate-[draw-path_1.5s_ease-out_forwards_0.5s]"
            />
          </g>

          {/* Sound waves - curved lines */}
          <path
            d="M 150 85 Q 160 85 165 90"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="2"
            opacity="0.7"
            className="animate-[fade-in_1.5s_ease-in-out_infinite_alternate]"
          />
          <path
            d="M 150 100 Q 165 100 175 100"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="2"
            opacity="0.6"
            className="animate-[fade-in_1.5s_ease-in-out_infinite_alternate_0.5s]"
          />
          <path
            d="M 150 115 Q 160 115 165 110"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="2"
            opacity="0.7"
            className="animate-[fade-in_1.5s_ease-in-out_infinite_alternate_1s]"
          />
        </svg>
      </div>
    );
  }

  if (variant === "messageBubbles") {
    return (
      <div className="aspect-square rounded-xl overflow-hidden relative bg-gradient-to-br from-destructive/10 to-secondary/10 shadow-lg">
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background gradient */}
          <defs>
            <linearGradient id="messageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" className="[stop-color:hsl(var(--destructive))]" stopOpacity="0.2" />
              <stop offset="100%" className="[stop-color:hsl(var(--secondary))]" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Smartphone outline */}
          <rect
            x="70"
            y="40"
            width="60"
            height="120"
            rx="8"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="2"
            className="[stroke-dasharray:360] [stroke-dashoffset:360] animate-[draw-path_2s_ease-out_forwards]"
          />
          
          {/* Screen area */}
          <rect
            x="75"
            y="50"
            width="50"
            height="100"
            rx="4"
            fill="url(#messageGrad)"
            opacity="0.3"
          />

          {/* Message bubble 1 - bottom right */}
          <g className="animate-[fade-in_2s_ease-out_infinite_alternate]">
            <rect
              x="85"
              y="120"
              width="35"
              height="20"
              rx="10"
              fill="none"
              stroke="hsl(var(--destructive))"
              strokeWidth="2"
            />
            <path
              d="M 115 135 L 120 140 L 118 135"
              fill="hsl(var(--destructive))"
              opacity="0.8"
            />
          </g>

          {/* Message bubble 2 - top left */}
          <g className="animate-[fade-in_2s_ease-out_infinite_alternate_0.7s]">
            <rect
              x="78"
              y="65"
              width="30"
              height="18"
              rx="9"
              fill="none"
              stroke="hsl(var(--secondary))"
              strokeWidth="2"
            />
            <path
              d="M 80 75 L 75 80 L 78 78"
              fill="hsl(var(--secondary))"
              opacity="0.8"
            />
          </g>

          {/* Message bubble 3 - middle right */}
          <g className="animate-[fade-in_2s_ease-out_infinite_alternate_1.4s]">
            <rect
              x="90"
              y="95"
              width="28"
              height="16"
              rx="8"
              fill="none"
              stroke="hsl(var(--destructive))"
              strokeWidth="2"
            />
          </g>

          {/* Typing indicator dots */}
          <g className="translate-x-[95px] translate-y-[100px]">
            <circle
              cx="0"
              cy="0"
              r="2"
              fill="hsl(var(--destructive))"
              className="animate-[bounce_1.5s_ease-in-out_infinite]"
            />
            <circle
              cx="7"
              cy="0"
              r="2"
              fill="hsl(var(--destructive))"
              className="animate-[bounce_1.5s_ease-in-out_infinite_0.2s]"
            />
            <circle
              cx="14"
              cy="0"
              r="2"
              fill="hsl(var(--destructive))"
              className="animate-[bounce_1.5s_ease-in-out_infinite_0.4s]"
            />
          </g>

          {/* Floating message bubbles outside phone */}
          <circle
            cx="145"
            cy="70"
            r="8"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="1.5"
            opacity="0.5"
            className="animate-[ping_3s_ease-out_infinite]"
          />
          <circle
            cx="50"
            cy="110"
            r="6"
            fill="none"
            stroke="hsl(var(--destructive))"
            strokeWidth="1.5"
            opacity="0.4"
            className="animate-[ping_3s_ease-out_infinite_1s]"
          />
        </svg>
      </div>
    );
  }

  // Default to envelope
  return (
    <div className="aspect-square rounded-xl overflow-hidden relative bg-gradient-to-br from-accent/10 to-primary/10 shadow-lg">
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background gradient */}
        <defs>
          <linearGradient id="envelopeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" className="[stop-color:hsl(var(--accent))]" stopOpacity="0.3" />
            <stop offset="100%" className="[stop-color:hsl(var(--primary))]" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Sparkle particles */}
        <circle
          cx="60"
          cy="70"
          r="3"
          fill="hsl(var(--accent))"
          opacity="0.6"
          className="animate-[ping_2s_ease-in-out_infinite]"
        />
        <circle
          cx="140"
          cy="85"
          r="2.5"
          fill="hsl(var(--primary))"
          opacity="0.5"
          className="animate-[ping_2s_ease-in-out_infinite_0.7s]"
        />
        <circle
          cx="75"
          cy="130"
          r="2"
          fill="hsl(var(--accent))"
          opacity="0.4"
          className="animate-[ping_2s_ease-in-out_infinite_1.4s]"
        />

        {/* Envelope body */}
        <rect
          x="60"
          y="85"
          width="80"
          height="60"
          rx="4"
          fill="url(#envelopeGrad)"
          stroke="hsl(var(--accent))"
          strokeWidth="2.5"
          className="[stroke-dasharray:280] [stroke-dashoffset:280] animate-[draw-path_2s_ease-out_forwards]"
        />

        {/* Envelope back flap lines */}
        <path
          d="M 60 85 L 100 115 L 140 85"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          className="[stroke-dasharray:120] [stroke-dashoffset:120] animate-[draw-path_2.5s_ease-out_forwards_0.5s]"
        />

        {/* Envelope front flap - animated open/close */}
        <g className="origin-[100px_85px] animate-[pulse_3s_ease-in-out_infinite]">
          <path
            d="M 60 85 L 100 105 L 140 85"
            fill="none"
            stroke="hsl(var(--accent))"
            strokeWidth="2.5"
            opacity="0.8"
          />
        </g>

        {/* Upward trending arrow/money symbols */}
        <g className="animate-[fade-in_3s_ease-in-out_infinite_alternate]">
          {/* Dollar sign 1 */}
          <text
            x="85"
            y="60"
            fontSize="18"
            fill="hsl(var(--primary))"
            opacity="0.7"
            className="font-bold"
          >
            $
          </text>
          
          {/* Upward arrow */}
          <path
            d="M 110 70 L 110 45 M 110 45 L 105 50 M 110 45 L 115 50"
            stroke="hsl(var(--accent))"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="animate-[fade-in_2.5s_ease-in-out_infinite_alternate_0.5s]"
          />
          
          {/* Dollar sign 2 */}
          <text
            x="120"
            y="55"
            fontSize="16"
            fill="hsl(var(--primary))"
            opacity="0.6"
            className="font-bold animate-[fade-in_2.5s_ease-in-out_infinite_alternate_1s]"
          >
            $
          </text>
        </g>

        {/* Letter/paper inside envelope */}
        <rect
          x="75"
          y="100"
          width="50"
          height="35"
          rx="2"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          opacity="0.5"
          strokeDasharray="4 2"
        />
        
        {/* Letter lines */}
        <line x1="82" y1="110" x2="115" y2="110" stroke="hsl(var(--accent))" strokeWidth="1" opacity="0.4" />
        <line x1="82" y1="117" x2="118" y2="117" stroke="hsl(var(--accent))" strokeWidth="1" opacity="0.4" />
        <line x1="82" y1="124" x2="110" y2="124" stroke="hsl(var(--accent))" strokeWidth="1" opacity="0.4" />
      </svg>
    </div>
  );
};

export default AnimatedServiceGraphic;
