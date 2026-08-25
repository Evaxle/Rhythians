import Image, { type StaticImageData } from "next/image";
import C1 from "@/Rank Icons/C1.png";
import C2 from "@/Rank Icons/C2.png";
import C3 from "@/Rank Icons/C3.png";
import C4 from "@/Rank Icons/C4.png";
import C5 from "@/Rank Icons/C5.png";
import B1 from "@/Rank Icons/B1.png";
import B2 from "@/Rank Icons/B2.png";
import B3 from "@/Rank Icons/B3.png";
import B4 from "@/Rank Icons/B4.png";
import B5 from "@/Rank Icons/B5.png";
import S1 from "@/Rank Icons/S1.png";
import S2 from "@/Rank Icons/S2.png";
import S3 from "@/Rank Icons/S3.png";
import S4 from "@/Rank Icons/S4.png";
import S5 from "@/Rank Icons/S5.png";
import G1 from "@/Rank Icons/G1.png";
import G2 from "@/Rank Icons/G2.png";
import G3 from "@/Rank Icons/G3.png";
import G4 from "@/Rank Icons/G4.png";
import G5 from "@/Rank Icons/G5.png";
import P1 from "@/Rank Icons/P1.png";
import P2 from "@/Rank Icons/P2.png";
import P3 from "@/Rank Icons/P3.png";
import P4 from "@/Rank Icons/P4.png";
import P5 from "@/Rank Icons/P5.png";
import E1 from "@/Rank Icons/E1.png";
import E2 from "@/Rank Icons/E2.png";
import E3 from "@/Rank Icons/E3.png";
import E4 from "@/Rank Icons/E4.png";
import E5 from "@/Rank Icons/E5.png";
import D1 from "@/Rank Icons/D1.png";
import D2 from "@/Rank Icons/D2.png";
import D3 from "@/Rank Icons/D3.png";
import D4 from "@/Rank Icons/D4.png";
import D5 from "@/Rank Icons/D5.png";
import M1 from "@/Rank Icons/M1.png";
import M2 from "@/Rank Icons/M2.png";
import M3 from "@/Rank Icons/M3.png";
import M4 from "@/Rank Icons/M4.png";
import M5 from "@/Rank Icons/M5.png";
import EXPERT from "@/Rank Icons/EXPERT.png";
import type { RankInfo } from "@/lib/ranks";

const RANK_ICON_SETS: StaticImageData[][] = [
  [C1, C2, C3, C4, C5],
  [B1, B2, B3, B4, B5],
  [S1, S2, S3, S4, S5],
  [G1, G2, G3, G4, G5],
  [P1, P2, P3, P4, P5],
  [E1, E2, E3, E4, E5],
  [D1, D2, D3, D4, D5],
  [M1, M2, M3, M4, M5],
];

export function getRankIcon(rank: RankInfo): StaticImageData {
  if (rank.isExpert) return EXPERT;
  return RANK_ICON_SETS[rank.index]?.[Math.max(0, Math.min(4, rank.tier - 1))] ?? C1;
}

export function RankIcon({ rank, size = 32, className }: { rank: RankInfo; size?: number; className?: string }) {
  return <Image src={getRankIcon(rank)} alt={`${rank.isExpert ? "Expert" : `${rank.name} ${rank.tier}`} rank`} width={size} height={size} className={`shrink-0 object-contain ${className ?? ""}`} />;
}
