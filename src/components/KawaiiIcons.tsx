type IconProps = { size?: number; className?: string };

export function WinkingSmiley({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="#FFD6E8" stroke="#F4A4B8" strokeWidth="2" />
      <circle cx="16" cy="20" r="3" fill="#6B4F5A" />
      <path d="M30 20 Q34 24 30 28" stroke="#6B4F5A" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M14 32 Q24 40 34 32" stroke="#F08099" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="34" cy="14" r="2" fill="#FFB5C9" opacity="0.8" />
    </svg>
  );
}

export function VintagePhone({ size = 26, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        d="M12 8 C8 8 6 12 8 18 L14 30 C16 34 20 36 24 34 L30 30 C32 28 32 24 28 22 L24 20 C22 19 20 20 19 22 L16 26 C14 24 10 18 12 14 Z"
        fill="#B5E2FA"
        stroke="#7EC8E3"
        strokeWidth="2"
      />
      <path d="M28 10 C32 8 38 10 40 16" stroke="#7EC8E3" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="36" cy="18" r="2" fill="#FFD6A5" />
    </svg>
  );
}

export function WingedLock({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M2 14 Q6 10 10 14" fill="#FFD6A5" stroke="#E8B86D" strokeWidth="1" />
      <path d="M22 14 Q26 10 30 14" fill="#FFD6A5" stroke="#E8B86D" strokeWidth="1" />
      <rect x="10" y="14" width="12" height="10" rx="2" fill="#F4A4B8" stroke="#E5989B" strokeWidth="1.5" />
      <path d="M13 14 V11 C13 8 19 8 19 11 V14" stroke="#E5989B" strokeWidth="2" fill="none" />
      <circle cx="16" cy="19" r="2" fill="#FFF5F7" />
    </svg>
  );
}

export function CatAvatar({ initials, size = 52 }: { initials: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="cat-avatar-svg">
      <ellipse cx="32" cy="38" rx="22" ry="20" fill="#FFD6E8" stroke="#F4A4B8" strokeWidth="2" />
      <path d="M14 22 L18 8 L26 18 Z" fill="#FFD6E8" stroke="#F4A4B8" strokeWidth="2" />
      <path d="M50 22 L46 8 L38 18 Z" fill="#FFD6E8" stroke="#F4A4B8" strokeWidth="2" />
      <circle cx="24" cy="34" r="3" fill="#6B4F5A" />
      <circle cx="40" cy="34" r="3" fill="#6B4F5A" />
      <ellipse cx="32" cy="40" rx="3" ry="2" fill="#F08099" />
      <path d="M26 44 Q32 48 38 44" stroke="#F08099" strokeWidth="1.5" fill="none" />
      <rect x="22" y="50" width="20" height="8" rx="4" fill="#B5E2FA" stroke="#7EC8E3" strokeWidth="1.5" />
      <text x="32" y="56" textAnchor="middle" fontSize="7" fontWeight="700" fill="#5A8FA8">{initials}</text>
    </svg>
  );
}

export function WinkingShield({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d="M24 4 L40 12 V24 C40 34 24 44 24 44 C24 44 8 34 8 24 V12 Z" fill="#FFD6A5" stroke="#E8B86D" strokeWidth="2" />
      <circle cx="18" cy="22" r="2.5" fill="#6B4F5A" />
      <path d="M28 22 Q32 26 28 30" stroke="#6B4F5A" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M16 32 Q24 38 32 32" stroke="#E8B86D" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function WingedHeart({ size = 24, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d="M4 20 Q8 14 14 18" fill="#FFD6E8" stroke="#F4A4B8" strokeWidth="1" />
      <path d="M44 20 Q40 14 34 18" fill="#FFD6E8" stroke="#F4A4B8" strokeWidth="1" />
      <path d="M24 38 C10 28 6 20 14 14 C18 10 24 14 24 14 C24 14 30 10 34 14 C42 20 38 28 24 38Z" fill="#F4A4B8" stroke="#E5989B" strokeWidth="2" />
      <circle cx="20" cy="22" r="1.5" fill="#FFF5F7" opacity="0.8" />
    </svg>
  );
}

export function KawaiiSmileBtn({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#FFD6E8" stroke="#F4A4B8" strokeWidth="2" />
      <circle cx="14" cy="17" r="2.5" fill="#6B4F5A" />
      <circle cx="26" cy="17" r="2.5" fill="#6B4F5A" />
      <path d="M12 24 Q20 32 28 24" stroke="#F08099" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function PaletteIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M20 4 C10 4 4 12 4 20 C4 28 10 32 16 32 H18 C20 32 22 30 22 28 C22 26 24 24 26 24 H30 C34 24 36 20 36 14 C36 8 28 4 20 4Z" fill="#E8D5F2" stroke="#C9A0DC" strokeWidth="2" />
      <circle cx="12" cy="16" r="3" fill="#FFB5C9" />
      <circle cx="20" cy="12" r="3" fill="#B5E2FA" />
      <circle cx="28" cy="16" r="3" fill="#C8F7DC" />
      <circle cx="16" cy="24" r="2.5" fill="#FFD6A5" />
    </svg>
  );
}

export function PaperPlane({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M4 20 L36 8 L24 36 L20 22 Z" fill="#B5E2FA" stroke="#7EC8E3" strokeWidth="2" strokeLinejoin="round" />
      <path d="M20 22 L36 8" stroke="#7EC8E3" strokeWidth="2" />
      <circle cx="28" cy="14" r="2" fill="#FFD6A5" />
    </svg>
  );
}

export function TinyLock({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="4" y="7" width="8" height="6" rx="1" fill="#B5E2FA" stroke="#7EC8E3" strokeWidth="1" />
      <path d="M6 7 V5.5 C6 4 10 4 10 5.5 V7" stroke="#7EC8E3" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

export function TinyCheck({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="#C8F7DC" stroke="#98D8AA" strokeWidth="1" />
      <path d="M5 8 L7 10 L11 6" stroke="#5A9A6E" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function MoodCat({ active }: { active?: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" className={active ? 'mood-icon active' : 'mood-icon'} aria-hidden="true">
      <circle cx="16" cy="18" r="12" fill={active ? '#FFD6E8' : '#FFF5F7'} stroke="#F4A4B8" strokeWidth="1.5" />
      <path d="M8 12 L10 4 L14 10 Z" fill={active ? '#FFD6E8' : '#FFF5F7'} stroke="#F4A4B8" strokeWidth="1.5" />
      <path d="M24 12 L22 4 L18 10 Z" fill={active ? '#FFD6E8' : '#FFF5F7'} stroke="#F4A4B8" strokeWidth="1.5" />
      <circle cx="12" cy="17" r="1.5" fill="#6B4F5A" />
      <circle cx="20" cy="17" r="1.5" fill="#6B4F5A" />
    </svg>
  );
}

export function MoodFox({ active }: { active?: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" className={active ? 'mood-icon active' : 'mood-icon'} aria-hidden="true">
      <ellipse cx="16" cy="18" rx="11" ry="10" fill={active ? '#FFD6A5' : '#FFF8EE'} stroke="#E8B86D" strokeWidth="1.5" />
      <path d="M6 14 L4 4 L12 12 Z" fill={active ? '#FFD6A5' : '#FFF8EE'} stroke="#E8B86D" strokeWidth="1.5" />
      <path d="M26 14 L28 4 L20 12 Z" fill={active ? '#FFD6A5' : '#FFF8EE'} stroke="#E8B86D" strokeWidth="1.5" />
      <circle cx="12" cy="18" r="1.5" fill="#6B4F5A" />
      <circle cx="20" cy="18" r="1.5" fill="#6B4F5A" />
      <circle cx="16" cy="22" r="2" fill="#FFF" />
    </svg>
  );
}

export function MoodBear({ active }: { active?: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" className={active ? 'mood-icon active' : 'mood-icon'} aria-hidden="true">
      <circle cx="16" cy="18" r="12" fill={active ? '#E8D5C4' : '#FFF8F0'} stroke="#C9A882" strokeWidth="1.5" />
      <circle cx="8" cy="10" r="5" fill={active ? '#E8D5C4' : '#FFF8F0'} stroke="#C9A882" strokeWidth="1.5" />
      <circle cx="24" cy="10" r="5" fill={active ? '#E8D5C4' : '#FFF8F0'} stroke="#C9A882" strokeWidth="1.5" />
      <circle cx="12" cy="17" r="1.5" fill="#6B4F5A" />
      <circle cx="20" cy="17" r="1.5" fill="#6B4F5A" />
      <ellipse cx="16" cy="21" rx="3" ry="2" fill="#C9A882" />
    </svg>
  );
}

export function CloudDecor({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M10 40 Q0 40 0 30 Q0 20 12 18 Q8 8 22 8 Q28 0 40 6 Q50 0 62 8 Q76 4 84 16 Q98 14 104 26 Q114 28 114 38 Q114 48 100 48 H20 Q10 48 10 40Z"
        fill="currentColor"
        opacity="0.35"
      />
    </svg>
  );
}

export function CodeCloud() {
  return (
    <div className="code-cloud">
      <svg width="80" height="40" viewBox="0 0 80 40" aria-hidden="true">
        <path
          d="M8 28 Q0 28 0 20 Q0 12 10 10 Q6 2 18 4 Q24 0 34 6 Q42 2 52 8 Q64 6 70 14 Q78 16 78 24 Q78 32 68 32 H14 Q8 32 8 28Z"
          fill="url(#codeCloudGrad)"
          stroke="#F4A4B8"
          strokeWidth="1.5"
        />
        <defs>
          <linearGradient id="codeCloudGrad" x1="0" y1="0" x2="80" y2="40">
            <stop offset="0%" stopColor="#FFD6E8" />
            <stop offset="100%" stopColor="#FFB5C9" />
          </linearGradient>
        </defs>
      </svg>
      <span className="code-cloud-label">Code</span>
    </div>
  );
}

export function BubbleStars() {
  return (
    <span className="bubble-decor" aria-hidden="true">
      <span className="bubble-star">✦</span>
      <span className="bubble-moon">☾</span>
    </span>
  );
}
