import Link from "next/link";

type UserNameProps = {
  username: string;
  discriminator?: string;
  profileHandle?: string;
  isCoach?: boolean;
  className?: string;
  link?: boolean;
};

export function UserName({ username, discriminator, profileHandle, isCoach = false, className = "", link = false }: UserNameProps) {
  const name = `${username}${discriminator ? `#${discriminator}` : ""}`;
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      {isCoach && <Link href="/coach" title="Rhythian Coach" aria-label="Rhythian Coach" className="shrink-0 cursor-pointer text-sm transition-transform hover:scale-110">👤</Link>}
      {link && profileHandle ? <Link href={`/profile/${profileHandle}`} className="min-w-0 truncate hover:text-accent">{name}</Link> : <span className="truncate">{name}</span>}
    </span>
  );
}
