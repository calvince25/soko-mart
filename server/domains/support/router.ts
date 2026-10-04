import { permissionProcedure, router } from "../../_core/trpc";
import { addEvidence, addMessage, assign, createTicket, escalate, getTicket, listMine, listSeller, operations, sla, updateStatus, upsertSla } from "./service";
import { addSupportMessageSchema, assignSupportSchema, createSupportTicketSchema, escalateSupportSchema, supportEvidenceSchema, supportIdSchema, supportListSchema, supportSlaListSchema, supportSlaPolicySchema, updateSupportStatusSchema } from "../../../shared/validation/supportSchemas";
export const supportRouter = router({
 create: permissionProcedure("support.ticket.create_own").input(createSupportTicketSchema).mutation(({ctx,input})=>createTicket(ctx.user.id,input)),
 listMine: permissionProcedure("support.ticket.read").input(supportListSchema).query(({ctx,input})=>listMine(ctx.user.id,input)),
 get: permissionProcedure("support.ticket.read").input(supportIdSchema).query(({ctx,input})=>getTicket(ctx.user.id,input.ticketId)),
 sellerList: permissionProcedure("support.ticket.read_seller").input(supportListSchema).query(({ctx,input})=>listSeller(ctx.user.id,input)),
 operations: permissionProcedure("support.ticket.manage").input(supportListSchema).query(({ctx,input})=>operations(ctx.user.id,input)),
 addMessage: permissionProcedure("support.message.create").input(addSupportMessageSchema).mutation(({ctx,input})=>addMessage(ctx.user.id,input)),
 assign: permissionProcedure("support.ticket.assign").input(assignSupportSchema).mutation(({ctx,input})=>assign(ctx.user.id,input)),
 updateStatus: permissionProcedure("support.ticket.manage").input(updateSupportStatusSchema).mutation(({ctx,input})=>updateStatus(ctx.user.id,input)),
 escalate: permissionProcedure("support.dispute.escalate").input(escalateSupportSchema).mutation(({ctx,input})=>escalate(ctx.user.id,input)),
 addEvidence: permissionProcedure("support.evidence.manage").input(supportEvidenceSchema).mutation(({ctx,input})=>addEvidence(ctx.user.id,input)),
 slaBreaches: permissionProcedure("support.sla.manage").input(supportSlaListSchema).query(({ctx,input})=>sla(ctx.user.id,input)),
 upsertSla: permissionProcedure("support.sla.manage").input(supportSlaPolicySchema).mutation(({ctx,input})=>upsertSla(ctx.user.id,input)),
});
