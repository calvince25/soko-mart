import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
const user={id:991601,openId:"support-test",name:"Support Test",email:"support@test.local",loginMethod:"test",role:"user" as const,createdAt:new Date(),updatedAt:new Date(),lastSignedIn:new Date()};
function ctx(permissions:string[]=[],currentUser:any=user):TrpcContext{return {user:currentUser,permissions:new Set(permissions),req:{protocol:"https",headers:{}} as any,res:{} as any};}
describe("Sprint 16 support boundaries",()=>{
 it("requires authentication",async()=>{const c=appRouter.createCaller({...ctx(),user:null});await expect(c.support.listMine({limit:10,offset:0})).rejects.toMatchObject({code:"UNAUTHORIZED"});});
 it("requires create permission",async()=>{const c=appRouter.createCaller(ctx());await expect(c.support.create({category:"order_issue",priority:"normal",subject:"Help",description:"Please help",idempotencyKey:"support-test-001",context:{}})).rejects.toMatchObject({code:"FORBIDDEN"});});
 it("rejects malformed content",async()=>{const c=appRouter.createCaller(ctx(["support.ticket.create_own"]));await expect(c.support.create({category:"order_issue",priority:"normal",subject:"",description:"valid",idempotencyKey:"support-test-002",context:{}})).rejects.toMatchObject({code:"BAD_REQUEST"});});
 it("keeps operations and seller visibility gated",async()=>{const c=appRouter.createCaller(ctx(["support.ticket.read"]));await expect(c.support.operations({limit:10,offset:0})).rejects.toMatchObject({code:"FORBIDDEN"});await expect(c.support.sellerList({limit:10,offset:0})).rejects.toMatchObject({code:"FORBIDDEN"});});
 it("keeps internal notes and escalation gated",async()=>{const c=appRouter.createCaller(ctx(["support.ticket.read"]));await expect(c.support.addMessage({ticketId:1,body:"internal",internal:true})).rejects.toMatchObject({code:"FORBIDDEN"});await expect(c.support.escalate({ticketId:1,note:"needs review",team:"payments"})).rejects.toMatchObject({code:"FORBIDDEN"});});
 it("rejects unsafe evidence URLs",async()=>{const c=appRouter.createCaller(ctx(["support.evidence.manage"]));await expect(c.support.addEvidence({ticketId:1,storageKey:"support/a.png",url:"bad",fileName:"a.png",mimeType:"image/png",sizeBytes:100})).rejects.toMatchObject({code:"BAD_REQUEST"});});
 it("exposes the support API surface",()=>{for(const key of ["support.create","support.listMine","support.get","support.sellerList","support.operations","support.addMessage","support.assign","support.updateStatus","support.escalate","support.addEvidence","support.slaBreaches"])expect(appRouter._def.procedures[key]).toBeDefined();});
});
