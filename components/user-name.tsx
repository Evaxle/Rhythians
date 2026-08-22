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
  const content = <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>{isCoach && <span title="This user is a verified rhythian coach" aria-label="This user is a verified rhythian coach" className="shrink-0 cursor-help text-sm">👤</span>}<span className="truncate">{username}{discriminator ? `#${discriminator}` : ""}</span></span>;
  if (link && profileHandle) return <Link href={`/profile/${profileHandle}`} className="inline-flex min-w-0 hover:text-accent">{content}</Link>;
  return content;
}
