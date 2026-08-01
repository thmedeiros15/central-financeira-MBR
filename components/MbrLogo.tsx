import React from 'react';

interface MbrLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isDarkBackground?: boolean;
}

export const MbrLogo: React.FC<MbrLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  isDarkBackground = true,
}) => {
  // Dimension mappings
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const mbrTextSizes = {
    sm: 'text-sm',
    md: 'text-xl',
    lg: 'text-3xl',
    xl: 'text-5xl',
  };

  const trackerTextSizes = {
    sm: 'text-[7px]',
    md: 'text-[9px]',
    lg: 'text-xs',
    xl: 'text-base',
  };

  const taglineTextSizes = {
    sm: 'text-[6px]',
    md: 'text-[8px]',
    lg: 'text-[10px]',
    xl: 'text-xs',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Icon Pin with M & Road */}
      <div className={`relative shrink-0 ${iconSizes[size]} flex items-center justify-center`}>
        <svg
          viewBox="0 0 200 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-[0_4px_10px_rgba(242,101,34,0.35)]"
        >
          <defs>
            {/* Orange metallic gradient */}
            <linearGradient id="mbrOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF7A00" />
              <stop offset="50%" stopColor="#F26522" />
              <stop offset="100%" stopColor="#D94100" />
            </linearGradient>

            {/* Dark asphalt road gradient */}
            <linearGradient id="mbrRoadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2A2D34" />
              <stop offset="100%" stopColor="#121316" />
            </linearGradient>

            {/* Subtle glow */}
            <filter id="orangeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Pin Outer Body */}
          <path
            d="M100 10 C50 10 12 48 12 98 C12 145 62 188 92 210 C96 213 104 213 108 210 C138 188 188 145 188 98 C188 48 150 10 100 10 Z"
            fill="url(#mbrOrangeGrad)"
          />

          {/* Inner Pin Cutout */}
          <path
            d="M100 32 C68 32 42 58 42 90 C42 122 72 155 100 178 C128 155 158 122 158 90 C158 58 132 32 100 32 Z"
            fill={isDarkBackground ? "#0A0E1A" : "#FFFFFF"}
          />

          {/* Stylized 'M' inside */}
          <path
            d="M58 125 L58 65 L88 105 L100 85 L112 105 L142 65 L142 125 L125 125 L125 88 L106 118 L94 118 L75 88 L75 125 Z"
            fill="url(#mbrOrangeGrad)"
          />

          {/* Road running through the bottom of 'M' */}
          <path
            d="M72 135 L90 85 L110 85 L128 135 Z"
            fill="url(#mbrRoadGrad)"
          />

          {/* Road center yellow dashed line */}
          <path
            d="M100 88 L100 132"
            stroke="#FFB800"
            strokeWidth="3"
            strokeDasharray="5 4"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Typography */}
      {variant !== 'icon' && (
        <div className="flex flex-col leading-none">
          {/* MBR title */}
          <div className={`font-black tracking-tighter flex items-center ${mbrTextSizes[size]}`}>
            <span className="text-[#F26522] italic font-extrabold">M</span>
            <span className={`italic font-extrabold ${isDarkBackground ? 'text-white' : 'text-slate-900'}`}>BR</span>
          </div>

          {variant === 'full' && (
            <>
              {/* TRACKER line */}
              <div className={`flex items-center gap-1 my-0.5 ${trackerTextSizes[size]}`}>
                <div className="h-[1.5px] flex-1 bg-[#F26522]"></div>
                <span className="font-extrabold tracking-[0.25em] text-[#F26522] uppercase">
                  TRACKER
                </span>
                <div className="h-[1.5px] flex-1 bg-[#F26522]"></div>
              </div>

              {/* Tagline */}
              <p className={`font-bold tracking-[0.18em] uppercase ${taglineTextSizes[size]} ${isDarkBackground ? 'text-slate-300' : 'text-slate-600'}`}>
                TECNOLOGIA QUE PROTEGE.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
