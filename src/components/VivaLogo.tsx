interface VivaLogoProps {
  className?: string;
  variant?: 'dark' | 'light';
}

export default function VivaLogo({ className = "h-12", variant = 'dark' }: VivaLogoProps) {
  // textColor for 'Cerâmica' and tagline
  const textColor = variant === 'light' ? '#F3F4F6' : '#262626';
  const taglineColor = variant === 'light' ? '#D1D5DB' : '#525252';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <svg
        viewBox="0 0 420 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-contain"
        aria-label="VIVA Cerâmica - Impossível não admirar"
      >
        <defs>
          <filter id="brush-texture" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        {/* BRUSH STROKES ON THE LEFT */}
        <g id="brush-mark">
          {/* Top Orange Brush Stroke */}
          <path
            d="M 68 88 
               C 52 74, 42 54, 52 38 
               C 62 22, 92 12, 118 6 
               C 134 3, 150 2, 164 12
               C 142 16, 118 25, 96 38 
               C 80 48, 70 62, 68 88 Z"
            fill="#EA580C"
          />
          {/* Orange dry brush flecks */}
          <path
            d="M 125 18 C 138 12, 156 8, 172 16 C 158 18, 142 21, 130 24 Z"
            fill="#F97316"
          />
          <path
            d="M 45 68 C 42 60, 44 50, 48 42 C 48 48, 46 58, 46 66 Z"
            fill="#EA580C"
          />

          {/* Lower Black Brush Stroke */}
          <path
            d="M 62 90 
               C 74 86, 92 78, 114 68 
               C 134 58, 154 50, 175 42
               C 188 38, 194 40, 186 46
               C 172 54, 150 64, 130 74
               C 106 84, 84 94, 62 90 Z"
            fill="#171717"
          />
          {/* Black dry brush textures & splatters */}
          <path
            d="M 94 76 C 118 68, 148 56, 178 50 C 162 56, 138 66, 110 77 Z"
            fill="#262626"
          />
          <path
            d="M 160 48 C 172 44, 186 42, 196 40 C 188 43, 176 46, 166 49 Z"
            fill="#171717"
          />
          <path
            d="M 80 84 C 70 86, 56 93, 62 90 C 72 85, 84 81, 98 78 Z"
            fill="#171717"
          />
        </g>

        {/* LOGO TEXT: VIVA */}
        <g id="viva-text" fill="#EA580C">
          {/* V */}
          <path
            d="M 194 42 L 206 78 H 216 L 228 42 H 218 L 211 67 L 204 42 Z"
            stroke="#EA580C"
            strokeWidth="3.5"
            strokeLinejoin="round"
            fill="#EA580C"
          />
          {/* I */}
          <rect x="237" y="42" width="9" height="36" rx="2" />
          
          {/* V */}
          <path
            d="M 255 42 L 267 78 H 277 L 289 42 H 279 L 272 67 L 265 42 Z"
            stroke="#EA580C"
            strokeWidth="3.5"
            strokeLinejoin="round"
            fill="#EA580C"
          />
          
          {/* A */}
          <path
            d="M 307 42 L 295 78 H 304 L 307 68 H 318 L 321 78 H 330 L 318 42 H 307 Z M 310 59 L 312.5 50 L 315 59 H 310 Z"
            stroke="#EA580C"
            strokeWidth="3"
            strokeLinejoin="round"
            fill="#EA580C"
          />
        </g>

        {/* SUBTITLE: Cerâmica */}
        <text
          x="264"
          y="93"
          textAnchor="middle"
          fill={textColor}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="17"
          fontWeight="600"
          letterSpacing="1.2"
        >
          Cerâmica
        </text>

        {/* SLOGAN: Impossível não admirar */}
        <text
          x="264"
          y="105"
          textAnchor="middle"
          fill={taglineColor}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontStyle="italic"
          fontSize="8.5"
          letterSpacing="0.8"
        >
          Impossível não admirar
        </text>
      </svg>
    </div>
  );
}
