import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { RANKS, getRankInfo } from "@/lib/ranks";
import { setUserPointOverride } from "@/lib/rhythia-mode-points";
import { syncHalfRhythiaRp } from "@/lib/profile-points";
import { placeBattleRanks } from "@/lib/rbp-placement";
import { modePointsFromEquivalentRhp } from "@/lib/ranking-system";

export const dynamic = "force-dynamic";

async function applyPoints(userId:string,rhp:number){
  const points={rpl:modePointsFromEquivalentRhp(rhp,"lock"),rps:modePointsFromEquivalentRhp(rhp,"spin"),rpv:modePointsFromEquivalentRhp(rhp,"vr")};
  await Promise.all([setUserPointOverride(userId,"rpl",points.rpl),setUserPointOverride(userId,"rps",points.rps),setUserPointOverride(userId,"rpv",points.rpv),setUserPointOverride(userId,"rhp",rhp)]);
  await prisma.user.update({where:{id:userId},data:{rhp}});
  return points;
}

export async function PATCH(request:Request){
  const admin=await getSessionUser();
  if(!admin)return NextResponse.json({error:"Unauthorized"},{status:401});
  if(!(await canAccessAdmin(admin)))return NextResponse.json({error:"Forbidden"},{status:403});
  const body=(await request.json().catch(()=>null)) as Record<string,unknown>|null;
  const action=typeof body?.action==="string"?body.action:"set-rank";
  if(action==="replace-all-battle-ranks"){
    const result=await placeBattleRanks(undefined,true);
    if(!result.season)return NextResponse.json({error:"There is no active battle season."},{status:409});
    await prisma.moderationAction.create({data:{actorId:admin.id,action:"battle_ranks_replaced",targetType:"rbp_season",targetId:result.season.id,metadata:{seasonNumber:result.season.seasonNumber,changed:result.changed}}});
    return NextResponse.json({ok:true,changed:result.changed,seasonNumber:result.season.seasonNumber});
  }
  const userIds=Array.isArray(body?.userIds)?[...new Set(body.userIds.filter((value):value is string=>typeof value==="string"&&value.length>0))]:[];
  if(!userIds.length)return NextResponse.json({error:"Select at least one player."},{status:400});
  if(userIds.length>500)return NextResponse.json({error:"You can update at most 500 players at once."},{status:400});
  const users=await prisma.user.findMany({where:{id:{in:userIds}},select:{id:true,username:true,profileHandle:true,rhp:true,rhythiaProfile:{select:{profileId:true}}}});
  if(users.length!==userIds.length)return NextResponse.json({error:"One or more selected players could not be found."},{status:404});
  if(action==="rebuild-rp"||action==="use-rp"||action==="sync-rp"){
    let changed=0;let skipped=0;const failures:string[]=[];const results:Array<{userId:string;rpl:number;rps:number;rpv:number;rhp:number}>=[];
    for(const user of users){
      if(!user.rhythiaProfile?.profileId){skipped++;continue;}
      try{
        const result=await syncHalfRhythiaRp(user.id);
        const values={userId:user.id,rpl:result.points.lock,rps:result.points.spin,rpv:result.points.vr,rhp:result.rhp};
        results.push(values);changed++;
        await prisma.moderationAction.create({data:{actorId:admin.id,action:"ranking_v2_synced",targetType:"user",targetId:user.id,metadata:{...values,bulk:users.length>1}}});
      }catch(error){failures.push(`${user.username}: ${error instanceof Error?error.message:"Rhythia scores could not be synced."}`);}
    }
    if(changed===0&&failures.length)return NextResponse.json({error:`No players were updated. ${failures.slice(0,3).join(" ")}`},{status:502});
    return NextResponse.json({ok:true,changed,skipped,failed:failures.length,failures:failures.slice(0,10),results});
  }
  const explicitRhp=body?.rhp!==undefined?Number(body.rhp):null;
  const rankIndex=Number(body?.rankIndex);
  if(explicitRhp!=null&&(!Number.isInteger(explicitRhp)||explicitRhp<0||explicitRhp>1000000))return NextResponse.json({error:"RHP must be a whole number between 0 and 1000000."},{status:400});
  if(explicitRhp==null&&(!Number.isInteger(rankIndex)||rankIndex<0||rankIndex>=RANKS.length))return NextResponse.json({error:"Invalid rank."},{status:400});
  const targetRhp=explicitRhp??RANKS[rankIndex].minRhp;
  const targetRank=getRankInfo(targetRhp);
  let changed=0;
  for(const user of users){
    const points=await applyPoints(user.id,targetRhp);changed++;
    await prisma.moderationAction.create({data:{actorId:admin.id,action:explicitRhp!=null?"rhp_v2_override":"rank_v2_override",targetType:"user",targetId:user.id,metadata:{fromRank:getRankInfo(user.rhp).name,fromRhp:user.rhp,toRank:targetRank.name,toRhp:targetRhp,...points}}});
  }
  if(explicitRhp==null&&users.length)await prisma.notification.createMany({data:users.map(user=>({userId:user.id,type:"rank_change",title:"Rank updated",message:`Your rank has been changed to ${targetRank.name}.`,url:`/profile/${encodeURIComponent(user.profileHandle)}`}))});
  return NextResponse.json({ok:true,changed,rank:targetRank.name,rhp:targetRhp});
}
