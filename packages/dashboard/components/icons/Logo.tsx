/* eslint-disable @next/next/no-img-element */

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export function Logo({ size = 32, className, showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className || ""}`}>
      <img
        src="/logo.png"
        alt="SwarmMind"
        width={size}
        height={size}
        className="rounded-lg"
      />
      {showText && (
        <span className="text-lg font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-green-400 bg-clip-text text-transparent">
          SwarmMind
        </span>
      )}
    </div>
  );
}
