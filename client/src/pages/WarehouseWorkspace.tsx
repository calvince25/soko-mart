import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, CheckCircle2, ClipboardList, Loader2, MapPin, PackageCheck, Plus, RefreshCw, ScanLine, Truck, Warehouse as WarehouseIcon } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const label = (value: string) => value.replaceAll("_", " ");
const statusClass = (status: string) => ["verified", "sorted", "dispatch_ready", "active", "resolved", "closed"].includes(status) ? "bg-[#e8f6ee] text-[#21834b]" : ["discrepancy", "rejected", "maintenance", "open"].includes(status) ? "bg-[#fff0ed] text-[#b42318]" : "bg-[#fff4e5] text-[#9a5b00]";
const shortDate = (value: string | Date | null | undefined) => value ? new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";

type Tab = "intake" | "sorting";

export default function WarehouseWorkspace() {
  const { isAuthenticated, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("intake");
  const [selectedIntakeId, setSelectedIntakeId] = useState<number | null>(null);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | undefined>(undefined);
  const [packageQtys, setPackageQtys] = useState<Record<number, number>>({});
  const [selectedBatchId, setSelectedBatchId] = useState<number | undefined>(undefined);
  const emptyInput = useMemo(() => ({}), []);
  const intakeInput = useMemo(() => ({ limit: 60, offset: 0 }), []);
  const packageInput = useMemo(() => ({ limit: 60, offset: 0 }), []);
  const batchInput = useMemo(() => ({ limit: 40, offset: 0 }), []);

  const dashboard = trpc.commerce.warehouse.dashboard.useQuery(emptyInput, { enabled: isAuthenticated, retry: false });
  const warehouses = trpc.commerce.warehouse.list.useQuery({ limit: 100, offset: 0 }, { enabled: isAuthenticated, retry: false });
  const handoffs = trpc.commerce.warehouse.eligibleHandoffs.useQuery(selectedWarehouseId ? { warehouseId: selectedWarehouseId } : {}, { enabled: isAuthenticated, retry: false });
  const intakes = trpc.commerce.warehouse.listIntakes.useQuery(intakeInput, { enabled: isAuthenticated, retry: false });
  const intakeDetail = trpc.commerce.warehouse.getIntake.useQuery({ intakeId: selectedIntakeId ?? 0 }, { enabled: isAuthenticated && Boolean(selectedIntakeId), retry: false });
  const packages = trpc.commerce.warehouse.listPackages.useQuery(packageInput, { enabled: isAuthenticated, retry: false });
  const batches = trpc.commerce.warehouse.listSortingBatches.useQuery(batchInput, { enabled: isAuthenticated, retry: false });

  const invalidateAll = async () => {
    await Promise.all([dashboard.refetch(), warehouses.refetch(), handoffs.refetch(), intakes.refetch(), packages.refetch(), batches.refetch(), intakeDetail.refetch()]);
  };
  const receive = trpc.commerce.warehouse.receiveIntake.useMutation({ onSuccess: async (data) => { toast.success(`Intake received for ${data.orderNumber ?? "seller order"}`); setSelectedIntakeId(data.intake.id); await invalidateAll(); }, onError: (error) => toast.error(error.message) });
  const verifyIntake = trpc.commerce.warehouse.verifyIntake.useMutation({ onSuccess: async () => { toast.success("Intake verification completed"); await invalidateAll(); }, onError: (error) => toast.error(error.message) });
  const createPackage = trpc.commerce.warehouse.createPackage.useMutation({ onSuccess: async () => { toast.success("Package recorded"); await invalidateAll(); }, onError: (error) => toast.error(error.message) });
  const verifyPackage = trpc.commerce.warehouse.verifyPackage.useMutation({ onSuccess: async () => { toast.success("Package verified"); await invalidateAll(); }, onError: (error) => toast.error(error.message) });
  const reportDiscrepancy = trpc.commerce.warehouse.reportDiscrepancy.useMutation({ onSuccess: async () => { toast.success("Discrepancy recorded"); await invalidateAll(); }, onError: (error) => toast.error(error.message) });
  const createBatch = trpc.commerce.warehouse.createSortingBatch.useMutation({ onSuccess: async (data) => { toast.success("Sorting batch created"); setSelectedBatchId(data.batch.id); await invalidateAll(); }, onError: (error) => toast.error(error.message) });
  const addToBatch = trpc.commerce.warehouse.addPackageToBatch.useMutation({ onSuccess: async () => { toast.success("Package added to sorting batch"); await invalidateAll(); }, onError: (error) => toast.error(error.message) });
  const dispatchReady = trpc.commerce.warehouse.markPackageDispatchReady.useMutation({ onSuccess: async () => { toast.success("Package marked dispatch-ready"); await invalidateAll(); }, onError: (error) => toast.error(error.message) });
  const closeBatch = trpc.commerce.warehouse.closeSortingBatch.useMutation({ onSuccess: async () => { toast.success("Sorting batch closed"); await invalidateAll(); }, onError: (error) => toast.error(error.message) });

  useEffect(() => {
    const detail: any = intakeDetail.data;
    if (!detail) return;
    const packed = new Map<number, number>();
    for (const packageDetail of detail.packages ?? []) for (const item of packageDetail.items ?? []) packed.set(item.packageItem.orderItemId, (packed.get(item.packageItem.orderItemId) ?? 0) + Number(item.packageItem.quantity));
    const next: Record<number, number> = {};
    for (const item of detail.orderItems ?? []) next[item.id] = Math.max(0, Number(item.quantity) - (packed.get(item.id) ?? 0));
    setPackageQtys(next);
  }, [selectedIntakeId, intakeDetail.data]);

  if (loading || (isAuthenticated && dashboard.isLoading)) return <Centered><Loader2 className="animate-spin text-[#e53935]" /></Centered>;
  if (!isAuthenticated) return <Centered><WarehouseIcon className="mx-auto text-[#e53935]" size={38} /><h1 className="mt-3 text-2xl font-black">Sign in to access warehouse operations</h1><p className="mt-2 max-w-sm text-sm text-[#65717d]">Only authorized warehouse staff, logistics managers, and administrators can view or change warehouse state.</p><button onClick={() => startLogin()} className="mt-5 bg-[#e53935] px-5 py-3 text-sm font-black text-white">Sign in</button></Centered>;

  const data: any = dashboard.data ?? { counts: {} };
  const selectedWarehouse = (warehouses.data ?? []).find((row: any) => row.id === selectedWarehouseId);
  const busy = receive.isPending || verifyIntake.isPending || createPackage.isPending || verifyPackage.isPending || reportDiscrepancy.isPending || createBatch.isPending || addToBatch.isPending || dispatchReady.isPending || closeBatch.isPending;

  return <div className="min-h-screen bg-[#f4f5f7] text-[#222b38]"><header className="border-b border-[#e1e4e7] bg-white"><div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"><div className="flex items-center gap-3"><Link href="/" className="text-sm font-black text-[#e53935]">SokoMart</Link><span className="text-[#d6dadd]">/</span><span className="text-sm font-bold">Warehouse operations</span></div><div className="flex items-center gap-3"><select value={selectedWarehouseId ?? ""} onChange={(event) => setSelectedWarehouseId(event.target.value ? Number(event.target.value) : undefined)} className="border border-[#dfe3e6] bg-white px-3 py-2 text-xs font-bold outline-none focus:border-[#e53935]"><option value="">All permitted warehouses</option>{(warehouses.data ?? []).map((warehouse: any) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.town}</option>)}</select><Link href="/account" className="text-xs font-black text-[#65717d]">Account</Link></div></div></header><main className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6"><div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#e53935]">Internal operations</p><h1 className="mt-1 text-3xl font-black tracking-[-0.06em]">Fulfilment centre control</h1><p className="mt-2 max-w-2xl text-sm text-[#65717d]">Receive seller handoffs, verify physical contents, group verified packages by destination, and create a clean dispatch-ready handoff for Sprint 12 delivery.</p></div><button onClick={() => invalidateAll()} disabled={busy} className="inline-flex items-center gap-2 border border-[#d6dadd] bg-white px-4 py-2.5 text-xs font-black text-[#4f5b66] disabled:opacity-50"><RefreshCw size={15} /> Refresh</button></div><section className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7"><Metric icon={<ClipboardList size={17} />} label="Awaiting intake" value={data.counts.awaitingIntake ?? 0} /><Metric icon={<PackageCheck size={17} />} label="Received" value={data.counts.received ?? 0} /><Metric icon={<ScanLine size={17} />} label="Verify" value={data.counts.verificationRequired ?? 0} /><Metric icon={<AlertTriangle size={17} />} label="Discrepancies" value={data.counts.discrepancies ?? 0} /><Metric icon={<Boxes size={17} />} label="Sort queue" value={data.counts.sortingQueue ?? 0} /><Metric icon={<Truck size={17} />} label="Dispatch ready" value={data.counts.dispatchReadyPackages ?? 0} /><Metric icon={<CheckCircle2 size={17} />} label="Active batches" value={data.counts.activeBatches ?? 0} /></section><div className="mb-5 flex gap-2 border-b border-[#dfe3e6]"><button onClick={() => setTab("intake")} className={`border-b-2 px-4 py-3 text-sm font-black ${tab === "intake" ? "border-[#e53935] text-[#e53935]" : "border-transparent text-[#65717d]"}`}>Intake & verification</button><button onClick={() => setTab("sorting")} className={`border-b-2 px-4 py-3 text-sm font-black ${tab === "sorting" ? "border-[#e53935] text-[#e53935]" : "border-transparent text-[#65717d]"}`}>Sorting & dispatch</button></div>{tab === "intake" ? <IntakePanel handoffs={handoffs.data ?? []} intakes={intakes.data ?? []} selectedIntakeId={selectedIntakeId} setSelectedIntakeId={setSelectedIntakeId} detail={intakeDetail.data} packageQtys={packageQtys} setPackageQtys={setPackageQtys} selectedWarehouse={selectedWarehouse} receive={(input: any) => receive.mutate(input)} verifyIntake={(id: number) => verifyIntake.mutate({ intakeId: id })} createPackage={(input: any) => createPackage.mutate(input)} verifyPackage={(id: number) => verifyPackage.mutate({ packageId: id })} reportDiscrepancy={(input: any) => reportDiscrepancy.mutate(input)} busy={busy} /> : <SortingPanel packages={packages.data ?? []} batches={batches.data ?? []} selectedBatchId={selectedBatchId} setSelectedBatchId={setSelectedBatchId} warehouseId={selectedWarehouseId ?? (warehouses.data ?? [])[0]?.id} createBatch={(input: any) => createBatch.mutate(input)} addToBatch={(input: any) => addToBatch.mutate(input)} dispatchReady={(id: number) => dispatchReady.mutate({ packageId: id })} closeBatch={(id: number) => closeBatch.mutate({ batchId: id })} busy={busy} />}</main></div>;
}

function IntakePanel({ handoffs, intakes, selectedIntakeId, setSelectedIntakeId, detail, packageQtys, setPackageQtys, selectedWarehouse, receive, verifyIntake, createPackage, verifyPackage, reportDiscrepancy, busy }: any) {
  return <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"><section className="space-y-5"><div className="bg-white p-5 shadow-sm"><SectionHeading icon={<Truck size={18} />} title="Seller handoffs" caption="Seller orders marked handed to logistics" /><div className="mt-4 space-y-3">{handoffs.length ? handoffs.map((item: any) => <div key={item.sellerOrder.id} className="rounded border border-[#eef0f2] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black text-[#e53935]">{item.orderNumber}</p><p className="mt-1 text-sm font-black">{item.sellerName}</p><p className="mt-1 text-xs text-[#65717d]">{item.address?.town}, {item.address?.county} · {item.sellerOrder.itemCount ?? "items"}</p></div><button disabled={busy || !selectedWarehouse} onClick={() => { const packageCount = Number(window.prompt("Expected number of packages", "1")); if (packageCount > 0) receive({ sellerOrderId: item.sellerOrder.id, warehouseId: selectedWarehouse.id, packageCount }); }} className="shrink-0 bg-[#e53935] px-3 py-2 text-xs font-black text-white disabled:opacity-50">Receive</button></div></div>) : <Empty icon={<Truck size={27} />} title="No seller handoffs waiting" text={selectedWarehouse ? "Seller orders handed to logistics will appear here." : "Select a permitted warehouse to receive a handoff."} />}</div></div><div className="bg-white p-5 shadow-sm"><SectionHeading icon={<ClipboardList size={18} />} title="Intake register" caption="Filter by warehouse status from the server" /><div className="mt-4 space-y-2">{intakes.length ? intakes.map((row: any) => <button key={row.intake.id} onClick={() => setSelectedIntakeId(row.intake.id)} className={`w-full border p-4 text-left transition ${selectedIntakeId === row.intake.id ? "border-[#e53935] bg-[#fff8f7]" : "border-[#eef0f2] bg-white hover:border-[#f2b6ae]"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black text-[#e53935]">{row.orderNumber}</p><p className="mt-1 text-sm font-black">{row.sellerName}</p><p className="mt-1 text-xs text-[#65717d]">{row.customerTown}, {row.customerCounty} · {shortDate(row.intake.createdAt)}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(row.intake.status)}`}>{label(row.intake.status)}</span></div></button>) : <Empty icon={<ClipboardList size={27} />} title="No intake records" text="Receiving a seller handoff creates the first warehouse traceability record." />}</div></div></section>{detail ? <IntakeDetail detail={detail} packageQtys={packageQtys} setPackageQtys={setPackageQtys} verifyIntake={verifyIntake} createPackage={createPackage} verifyPackage={verifyPackage} reportDiscrepancy={reportDiscrepancy} busy={busy} /> : <div className="flex min-h-[420px] items-center justify-center bg-white p-8 text-center shadow-sm"><div><ScanLine className="mx-auto text-[#e53935]" size={38} /><h2 className="mt-3 text-xl font-black">Select an intake</h2><p className="mt-2 max-w-sm text-sm text-[#65717d]">Open a seller handoff or intake record to inspect order-item traceability, create split packages, and verify contents.</p></div></div>}</div>;
}

function IntakeDetail({ detail, packageQtys, setPackageQtys, verifyIntake, createPackage, verifyPackage, reportDiscrepancy, busy }: any) {
  const intake = detail.intake;
  const hasOpen = (detail.discrepancies ?? []).some((row: any) => ["open", "in_review"].includes(row.resolutionStatus));
  return <section className="space-y-5"><div className="bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black text-[#e53935]">{detail.orderNumber}</p><h2 className="mt-1 text-xl font-black">{detail.seller?.storeName ?? "Seller intake"}</h2><p className="mt-1 text-sm text-[#65717d]">{detail.address?.recipientName} · {detail.address?.town}, {detail.address?.county}</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(intake.status)}`}>{label(intake.status)}</span>{["verification_required", "discrepancy"].includes(intake.status) && <button disabled={busy} onClick={() => verifyIntake(intake.id)} className="bg-[#26323e] px-3 py-2 text-xs font-black text-white disabled:opacity-50">Verify intake</button>}</div></div><div className="mt-5 grid grid-cols-3 gap-3"><Mini label="Expected items" value={intake.expectedItemCount} /><Mini label="Received items" value={intake.receivedItemCount} /><Mini label="Packages" value={`${detail.packages.length}/${intake.packageCount}`} /></div></div><div className="bg-white p-5 shadow-sm"><SectionHeading icon={<PackageCheck size={18} />} title="Package contents" caption="Each quantity links back to an immutable order item" /><div className="mt-4 space-y-3">{(detail.orderItems ?? []).map((item: any) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0f1f2] pb-3"><div><p className="text-sm font-black">{item.productName}</p><p className="mt-1 text-xs text-[#65717d]">{item.variantName} · SKU {item.sku} · ordered {item.quantity}</p></div><input type="number" min="0" max={item.quantity} value={packageQtys[item.id] ?? 0} onChange={(event) => setPackageQtys((current: any) => ({ ...current, [item.id]: Number(event.target.value) }))} className="w-24 border border-[#dfe3e6] px-3 py-2 text-right text-sm font-black outline-none focus:border-[#e53935]" /></div>)}{(detail.orderItems ?? []).length ? <button disabled={busy || !Object.values(packageQtys).some((value: any) => value > 0)} onClick={() => createPackage({ intakeId: intake.id, items: Object.entries(packageQtys).filter(([, quantity]: any) => quantity > 0).map(([orderItemId, quantity]) => ({ orderItemId: Number(orderItemId), quantity: Number(quantity) })) })} className="mt-2 inline-flex items-center gap-2 bg-[#e53935] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"><Plus size={15} /> Record package</button> : <p className="text-sm text-[#65717d]">No order items available.</p>}</div></div><div className="bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><SectionHeading icon={<Boxes size={18} />} title="Recorded packages" caption="Verify each physical package once" /><span className="text-xs font-black text-[#65717d]">{detail.packages.length} package{detail.packages.length === 1 ? "" : "s"}</span></div><div className="mt-4 space-y-3">{detail.packages.length ? detail.packages.map((item: any) => <div key={item.package.id} className="border border-[#eef0f2] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-black">{item.package.packageReference}</p><p className="mt-1 text-xs text-[#65717d]">{item.package.destinationTown}, {item.package.destinationCounty} · {item.items.length} line{item.items.length === 1 ? "" : "s"}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(item.package.status)}`}>{label(item.package.status)}</span>{["received", "verification_required"].includes(item.package.status) && <button disabled={busy} onClick={() => verifyPackage(item.package.id)} className="border border-[#e53935] px-3 py-2 text-xs font-black text-[#e53935] disabled:opacity-50">Verify</button>}</div></div>{item.discrepancies.length ? <p className="mt-3 text-xs font-bold text-[#b42318]">{item.discrepancies.length} discrepancy record(s)</p> : null}</div>) : <Empty icon={<Boxes size={27} />} title="No packages recorded" text="Create one or more package records from the order items above. Split packages remain traceable to the same seller order." />}</div></div><div className="bg-white p-5 shadow-sm"><SectionHeading icon={<AlertTriangle size={18} />} title="Discrepancies" caption="Record missing, excess, damaged, or wrong-item issues" /><button disabled={busy} onClick={() => { const description = window.prompt("Describe the discrepancy"); if (!description) return; const type = window.prompt("Type: missing_item, excess_item, damaged_package, wrong_item", "damaged_package") as any; reportDiscrepancy({ intakeId: intake.id, type: ["missing_item", "excess_item", "damaged_package", "wrong_item", "incomplete_shipment", "packaging_problem"].includes(type) ? type : "damaged_package", description, quantity: 1 }); }} className="mt-4 border border-[#e53935] px-3 py-2 text-xs font-black text-[#e53935] disabled:opacity-50">Record discrepancy</button>{hasOpen ? <p className="mt-3 text-xs font-bold text-[#b42318]">Open discrepancies block intake verification until resolved by an authorized operator.</p> : null}{detail.discrepancies.length ? <div className="mt-4 space-y-2">{detail.discrepancies.map((row: any) => <div key={row.id} className="rounded bg-[#fff8f7] p-3 text-sm"><div className="flex justify-between gap-3"><span className="font-black capitalize">{label(row.type)}</span><span className={`rounded-full px-2 py-1 text-[10px] font-black capitalize ${statusClass(row.resolutionStatus)}`}>{label(row.resolutionStatus)}</span></div><p className="mt-1 text-xs text-[#65717d]">{row.description}</p></div>)}</div> : null}</div></section>;
}

function SortingPanel({ packages, batches, selectedBatchId, setSelectedBatchId, warehouseId, createBatch, addToBatch, dispatchReady, closeBatch, busy }: any) {
  const sortable = packages.filter((row: any) => ["verified", "sorted", "dispatch_ready"].includes(row.package.status));
  const availableBatches = batches.filter((row: any) => ["open", "sorting"].includes(row.batch.status));
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading icon={<Boxes size={18} />} title="Sortable packages" caption="Verified packages remain linked to seller orders and destinations" />
          <span className="text-xs font-black text-[#65717d]">{sortable.length} ready</span>
        </div>
        <div className="mt-4 space-y-3">
          {sortable.length ? sortable.map((row: any) => (
            <div key={row.package.id} className="border border-[#eef0f2] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black">{row.package.packageReference}</p>
                  <p className="mt-1 text-xs text-[#65717d]">{row.orderNumber} · {row.sellerName}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#4f5b66]"><MapPin size={13} /> {row.package.destinationTown}, {row.package.destinationCounty}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(row.package.status)}`}>{label(row.package.status)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.package.status === "verified" ? <>
                  <button disabled={busy || !warehouseId} onClick={() => {
                    const selected = window.prompt("Create batch destination as county,town", `${row.package.destinationCounty},${row.package.destinationTown}`)?.split(",");
                    if (!selected?.[0] || !selected?.[1]) return;
                    createBatch({ warehouseId, destinationCountry: row.package.destinationCountry, destinationCounty: selected[0].trim(), destinationTown: selected[1].trim(), destinationZone: row.package.destinationZone ?? undefined, deliveryMethod: row.package.deliveryMethod ?? undefined });
                  }} className="inline-flex items-center gap-1 bg-[#e53935] px-3 py-2 text-xs font-black text-white disabled:opacity-50"><Plus size={14} /> New batch</button>
                  {availableBatches.length ? <>
                    <select value={selectedBatchId ?? ""} onChange={(event) => setSelectedBatchId(event.target.value ? Number(event.target.value) : undefined)} className="border border-[#dfe3e6] bg-white px-2 py-2 text-xs font-bold">
                      <option value="">Choose batch</option>
                      {availableBatches.map((batch: any) => <option key={batch.batch.id} value={batch.batch.id}>{batch.batch.batchReference} · {batch.batch.destinationCounty}</option>)}
                    </select>
                    <button disabled={busy || !selectedBatchId} onClick={() => addToBatch({ batchId: selectedBatchId, packageId: row.package.id })} className="border border-[#26323e] px-3 py-2 text-xs font-black text-[#26323e] disabled:opacity-50">Add to batch</button>
                  </> : null}
                </> : null}
                {row.package.status === "sorted" ? <button disabled={busy} onClick={() => dispatchReady(row.package.id)} className="bg-[#26323e] px-3 py-2 text-xs font-black text-white disabled:opacity-50"><Truck className="mr-1 inline" size={14} /> Dispatch ready</button> : null}
              </div>
            </div>
          )) : <Empty icon={<Boxes size={30} />} title="No verified packages" text="Verify intake contents first. Packages marked verified will appear here for destination grouping." />}
        </div>
      </section>
      <section className="bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading icon={<Truck size={18} />} title="Sorting batches" caption="Group packages by destination and delivery method" />
          <span className="text-xs font-black text-[#65717d]">{batches.length} batch{batches.length === 1 ? "" : "es"}</span>
        </div>
        <div className="mt-4 space-y-3">
          {batches.length ? batches.map((row: any) => (
            <div key={row.batch.id} className="border border-[#eef0f2] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black">{row.batch.batchReference}</p>
                  <p className="mt-1 text-xs font-bold capitalize text-[#4f5b66]">{row.batch.destinationTown}, {row.batch.destinationCounty}</p>
                  <p className="mt-1 text-xs text-[#65717d]">{row.packages.length} package{row.packages.length === 1 ? "" : "s"} · created {shortDate(row.batch.createdAt)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize ${statusClass(row.batch.status)}`}>{label(row.batch.status)}</span>
              </div>
              {row.batch.status === "dispatch_ready" ? <button disabled={busy} onClick={() => closeBatch(row.batch.id)} className="mt-3 w-full bg-[#e53935] px-3 py-2 text-xs font-black text-white disabled:opacity-50">Close batch</button> : null}
            </div>
          )) : <Empty icon={<ClipboardList size={27} />} title="No sorting batches" text="Create a batch from a verified package to start destination sorting." />}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-[#e53935]"><span className="text-xs font-black uppercase tracking-wide text-[#65717d]">{label}</span>{icon}</div><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function Mini({ label, value }: { label: string; value: React.ReactNode }) { return <div className="rounded bg-[#f7f8f9] p-3"><p className="text-[11px] font-black uppercase tracking-wide text-[#65717d]">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>; }
function SectionHeading({ icon, title, caption }: { icon: React.ReactNode; title: string; caption: string }) { return <div className="flex items-start gap-3"><span className="mt-0.5 text-[#e53935]">{icon}</span><div><h2 className="text-base font-black">{title}</h2><p className="mt-1 text-xs text-[#65717d]">{caption}</p></div></div>; }
function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="py-8 text-center"><div className="mx-auto w-fit text-[#aab2ba]">{icon}</div><h3 className="mt-3 text-sm font-black">{title}</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#65717d]">{text}</p></div>; }
function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] p-6 text-center">{children}</div>; }
