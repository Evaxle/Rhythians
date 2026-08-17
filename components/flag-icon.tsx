interface FlagIconProps {
  flag?: string | null;
  country?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const FLAG_SIZES = {
  sm: "w20",
  md: "w40",
  lg: "w80",
};

export function FlagIcon({ flag, country, size = "sm", className = "" }: FlagIconProps) {
  if (!flag) return null;

  const code = flag.trim().toLowerCase();
  const width = FLAG_SIZES[size];

  return (
    <img
      src={`https://flagcdn.com/${width}/${code}.png`}
      alt={`${country ?? code} flag`}
      title={country ?? code}
      className={`inline-block h-3.5 w-5 rounded-sm object-cover align-middle ${className}`}
      loading="lazy"
    />
  );
}