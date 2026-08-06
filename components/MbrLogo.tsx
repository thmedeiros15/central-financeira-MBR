import React from 'react';
import logoPreta from '../assets/mbr logo nova preta.jpeg';
import logoBranca from '../assets/mbr logo nova branca.jpeg';

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
  const logoImage = isDarkBackground ? logoPreta : logoBranca;
  const containerBg = isDarkBackground ? 'bg-black border-slate-800/60' : 'bg-white border-slate-200';

  // Sizing definitions based on height and 1:1 aspect ratio (square)
  const heightClasses = {
    sm: 'h-8 w-8',
    md: 'h-11 w-11',
    lg: 'h-14 w-14',
    xl: 'h-20 w-20',
  };

  const iconHeightClasses = {
    sm: 'h-8 w-8',
    md: 'h-11 w-11',
    lg: 'h-14 w-14',
    xl: 'h-16 w-16',
  };

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center justify-center ${containerBg} rounded-xl overflow-hidden border shadow-sm ${iconHeightClasses[size]} ${className}`}>
        <img
          src={logoImage}
          alt="MBR Tracker Icon"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center justify-center ${containerBg} rounded-2xl overflow-hidden border shadow-md ${heightClasses[size]} ${className}`}>
      <img
        src={logoImage}
        alt="MBR Tracker"
        className="w-full h-full object-cover"
      />
    </div>
  );
};
