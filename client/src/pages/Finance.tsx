import { useMemo, useState } from "react";
import { BookOpen, Loader2, LockKeyhole, Phone, ShieldCheck, WalletCards } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";

function money(value: number, currency = "KES") {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(value / 100);
}

const statusStyles: Record<string, string> = {
  DRAFT: "bg-[#f3f4f6] text-[#4b5563]",
  PENDING_VERIFICATION: "bg-[#fff4e5] text-[#9a5b00]",
  VERIFIED: "bg-[#eef8f1] text-[#21834b]",
  SUSPENDED: "bg-[#fff0f0] text-[#a12626]",
  DEACTIVATED: "bg-[#f3f4f6] text-[#65717d]",
  REJECTED: "bg-[#fff0f0] text-[#a12626]",
};

function Status({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${statusStyles[value] ?? statusStyles.DRAFT}`}>{value.replaceAll("_", " ")}</span>;
}

export default function Finance() {
  const { isAuthenticated, loading } = useAuth();
  const [phone, setPhone] = useState("");
  const [label, setLabel] = useState("");
  const summary = trpc.finance.mySummary.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const ledger = trpc.finance.myLedger.useQuery({ limit: 30, offset: 0 }, { enabled: isAuthenticated, retry: false });
  const sellerId = summary.data?.sellerId;
  const beneficiaryInput = useMemo(() => (sellerId ? { sellerId } : {}), [sellerId]);
  const beneficiaries = trpc.finance.beneficiaries.listMine.useQuery(beneficiaryInput, { enabled: isAuthenticated && Boolean(sellerId), retry: false });
  const utils = trpc.useUtils();
  const create = trpc.finance.beneficiaries.create.useMutation({
    onSuccess: () => { toast.success("Payout account saved as draft"); setPhone(""); setLabel(""); void utils.finance.beneficiaries.listMine.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const submit = trpc.finance.beneficiaries.submit.useMutation({ onSuccess: () => { toast.success("Payout account submitted for verification"); void utils.finance.beneficiaries.listMine.invalidate(); }, onError: (error) => toast.error(error.message) });
  const setPrimary = trpc.finance.beneficiaries.setPrimary.useMutation({ onSuccess: () => { toast.success("Primary payout account updated"); void utils.finance.beneficiaries.listMine.invalidate(); }, onError: (error) => toast.error(error.message) });
  const deactivate = trpc.finance.beneficiaries.deactivate.useMutation({ onSuccess: () => { toast.success("Payout account deactivated"); void utils.finance.beneficiaries.listMine.invalidate(); }, onError: (error) => toast.error(error.message) });

  if (loading || (isAuthenticated && (summary.isLoading || ledger.isLoading))) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-[#e53935]" /></div>;
  if (!isAuthenticated) return <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] p-6 text-center"><div><WalletCards className="mx-auto text-[#e53935]" /><h1 className="mt-3 text-2xl font-black">Seller finance</h1><button onClick={() => startLogin()} className="mt-4 bg-[#e53935] px-5 py-3 text-white">Sign in</button></div></div>;

  const s: any = summary.data;
  const rows: any[] = beneficiaries.data ?? [];
  const canCreate = Boolean(sellerId) && !create.isPending;
  return <div className="min-h-screen bg-[#f4f5f7] text-[#222b38]">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-[1180px] justify-between px-4 py-4"><Link href="/seller" className="font-black text-[#e53935]">← Seller Center</Link><Link href="/seller/support" className="font-bold">Support</Link></div></header>
    <main className="mx-auto max-w-[1180px] px-4 py-8">
      <p className="text-xs font-black uppercase tracking-widest text-[#e53935]">Finance</p>
      <h1 className="mt-1 text-3xl font-black">Earnings & settlements</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Net earnings" value={money(s?.netMinor ?? 0)} /><Metric label="Available" value={money(s?.availableMinor ?? 0)} /><Metric label="On hold" value={money(s?.holdsMinor ?? 0)} /><Metric label="Settled" value={money(s?.settledMinor ?? 0)} /></div>

      <section className="mt-7 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3"><div className="rounded-full bg-[#fff4e5] p-2 text-[#9a5b00]"><ShieldCheck size={18} /></div><div><h2 className="font-black">Payout account</h2><p className="mt-1 text-sm text-[#65717d]">Add a seller-owned M-Pesa destination for future provider-backed settlements. SokoMart does not store your PIN or initiate a payout until a provider is configured.</p></div></div>
        <form className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); if (!sellerId) return; create.mutate({ sellerId, provider: "mpesa", accountType: "mobile_money", phone, displayLabel: label || null }); }}>
          <label className="flex items-center gap-2 border border-[#d9dee3] px-3"><Phone size={16} className="text-[#8a949d]" /><input required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07xx xxx xxx or +254..." className="min-w-0 flex-1 py-3 text-sm outline-none" /></label>
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Label (e.g. Main Till)" className="border border-[#d9dee3] px-3 py-3 text-sm outline-none" />
          <button disabled={!canCreate} className="bg-[#e53935] px-5 py-3 text-sm font-black text-white disabled:opacity-50">Save draft</button>
        </form>
        <div className="mt-3 flex items-center gap-2 text-xs text-[#65717d]"><LockKeyhole size={14} /> Only a masked destination and secure fingerprint are retained.</div>
        <div className="mt-6 space-y-3">{rows.length ? rows.map(({ beneficiary, events }: any) => <article key={beneficiary.id} className="border border-[#eef0f2] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><p className="font-black">{beneficiary.displayLabel || "M-Pesa account"}</p>{beneficiary.isPrimary === 1 && <span className="text-[10px] font-black uppercase text-[#21834b]">Primary</span>}</div><p className="mt-1 text-sm text-[#65717d]">{beneficiary.maskedDestination} · {beneficiary.provider.toUpperCase()}</p></div><Status value={beneficiary.status} /></div><div className="mt-3 flex flex-wrap gap-2">{beneficiary.status === "DRAFT" || beneficiary.status === "REJECTED" ? <button disabled={submit.isPending} onClick={() => submit.mutate({ beneficiaryId: beneficiary.id })} className="bg-[#26323e] px-3 py-2 text-xs font-black text-white">Submit for verification</button> : null}{beneficiary.status === "VERIFIED" && beneficiary.isPrimary !== 1 ? <button disabled={setPrimary.isPending} onClick={() => setPrimary.mutate({ beneficiaryId: beneficiary.id })} className="bg-[#21834b] px-3 py-2 text-xs font-black text-white">Make primary</button> : null}{!["DEACTIVATED"].includes(beneficiary.status) ? <button disabled={deactivate.isPending} onClick={() => deactivate.mutate({ beneficiaryId: beneficiary.id })} className="border border-[#a12626] px-3 py-2 text-xs font-black text-[#a12626]">Deactivate</button> : null}</div><p className="mt-3 text-[11px] text-[#8a949d]">{events?.length ?? 0} audited lifecycle event{events?.length === 1 ? "" : "s"}</p></article>) : <p className="border border-dashed border-[#d9dee3] p-5 text-sm text-[#65717d]">No payout accounts yet. Save a draft to begin verification.</p>}</div>
      </section>

      <section className="mt-7 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><BookOpen size={18} className="text-[#e53935]" /><h2 className="font-black">Immutable ledger activity</h2></div><div className="mt-4 space-y-2">{ledger.data?.map((row: any) => <div key={`${row.transaction.id}-${row.entry.id}`} className="flex justify-between border-b py-3 text-sm"><div><p className="font-bold">{row.transaction.eventType.replaceAll("_", " ")}</p><p className="text-xs text-[#65717d]">{row.transaction.transactionNumber} · {row.entry.lineType}</p></div><p className="font-black">{money(Number(row.entry.debitMinor) - Number(row.entry.creditMinor), row.entry.currency)}</p></div>)}{!ledger.data?.length && <p className="py-8 text-center text-sm text-[#65717d]">Ledger activity will appear after a successful paid order is finalized.</p>}</div></section>
    </main>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase text-[#65717d]">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>; }
