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
  const coachIcon = isCoach ? (
    <Link href="/coach" title="Rhythian Coach" aria-label="Rhythian Coach" className="shrink-0 cursor-pointer text-sm transition-transform hover:scale-110">
      👤
    </Link>
  ) : null;
  const content = <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>{coachIcon}<span className="truncate">{username}{discriminator ? `#${discriminator}` : ""}</span></span>;
  if (link && profileHandle) return <Link href={`/profile/${profileHandle}`} className="inline-flex min-w-0 hover:text-accent">{content}</Link>;
  return content;
}
