import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessAdmin } from "@/lib/admin-access";
import { RANKS, getRankInfo } from "@/lib/ranks";
import { setUserPointOverride, syncUserModeScores } from "@/lib/rhythia-mode-points";
import { placeBattleRanks } from "@/lib/rbp-placement";
import { modePointsFromEquivalentRhp } from "@/lib/ranking-system";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function applyPoints(userId:string,rhp:number){
  const points={rpl:modePointsFromEquivalentRhp(rhp,"lock"),rps:modePointsFromEquivalentRhp(rhp,"spin"),rpv:modePointsFromEquivalentRhp(rhp,"vr")};
  await Promise.all([setUserPointOverride(userId,"rpl",points.rpl),setUserPointOverride(userId,"rps",points.rps),setUserPointOverride(userId,"rpv",points.rpv),setUserPointOverride(userId,"rhp",rhp)]);
  await prisma.user.update({where:{id:userId},data:{rhp}});
  return points;
}

async function rebuildAllRanks(actorId:string){
  const users=await prisma.user.findMany({where:{NOT:{profileHandle:"rhythia-imports"}},select:{id:true,username:true,rhythiaProfile:{select:{profileId:true}}},orderBy:{createdAt:"asc"}});

  // Remove manual rank overrides, but never erase stored score history or pre-zero users.
  // Each successful Rhythia sync replaces the derived totals in place; a failed sync keeps
  // the user's last known good RPL/RPS/RPV/RHP instead of leaving them at zero.
  await prisma.$executeRawUnsafe('DELETE FROM "UserPointOverride" WHERE system IN (\'rhp\',\'rpl\',\'rps\',\'rpv\')');
  await prisma.user.updateMany({
    where:{id:{in:users.map(user=>user.id)}},
    data:{scoreImportDone:false,lastRhythiaRpCheckAt:null},
  });

  const linked=users.filter(user=>user.rhythiaProfile?.profileId!=null);
  const failures:string[]=[];
  let rebuilt=0;
  for(let index=0;index<linked.length;index+=3){
    const batch=linked.slice(index,index+3);
    const results=await Promise.all(batch.map(async user=>{
      try{await syncUserModeScores(user.id);return null;}
      catch(error){return `${user.username}: ${error instanceof Error?error.message:"score rebuild failed"}`;}
    }));
    for(const failure of results){if(failure)failures.push(failure);else rebuilt++;}
  }
  const battle=await placeBattleRanks(undefined,true).catch(()=>null);
  await prisma.moderationAction.create({data:{actorId,action:"all_rankings_rebuilt",targetType:"ranking_system",targetId:"all-users",metadata:{totalUsers:users.length,linkedUsers:linked.length,rebuilt,failed:failures.length,battleRanksChanged:battle?.changed??0,nonDestructive:true}}});
  return{totalUsers:users.length,linkedUsers:linked.length,rebuilt,skipped:users.length-linked.length,failed:failures.length,failures:failures.slice(0,10),battleRanksChanged:battle?.changed??0};
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
  if(action==="reset-all-ranks"){
    try{return NextResponse.json({ok:true,...await rebuildAllRanks(admin.id)});}
    catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to rebuild rankings."},{status:500});}
  }
  const userIds=Array.isArray(body?.userIds)?[...new Set(body.userIds.filter((value):value is string=>typeof value==="string"&&value.length>0))]:[];
  if(!userIds.length)return NextResponse.json({error:"Select at least one player."},{status:400});
  if(userIds.length>500)return NextResponse.json({error:"You can update at most 500 players at once."},{status:400});
  const users=await prisma.user.findMany({where:{id:{in:userIds}},select:{id:true,username:true,profileHandle:true,rhp:true,rhythiaProfile:{select:{profileId:true}}}});
  if(users.length!==userIds.length)return NextResponse.json({error:"One or more selected players could not be found."},{status:404});
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
