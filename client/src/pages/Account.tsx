import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check, Loader2, MapPin, Phone, Save, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const emptyAddress = {
  recipientName: "",
  recipientPhone: "",
  label: "home" as "home" | "work" | "other",
  country: "Kenya",
  county: "",
  town: "",
  neighborhood: "",
  estateBuilding: "",
  apartmentHouse: "",
  streetRoad: "",
  directions: "",
  postalCode: "",
  latitude: "",
  longitude: "",
  isDefault: false,
};

export default function Account() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const utils = trpc.useUtils();
  const accountQuery = trpc.account.get.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const [profile, setProfile] = useState({ firstName: "", lastName: "", displayName: "", preferredLanguage: "en", preferredCurrency: "KES" });
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(emptyAddress);
  const [showAddressForm, setShowAddressForm] = useState(false);

  useEffect(() => {
    if (!accountQuery.data) return;
    const next = accountQuery.data;
    setProfile({
      firstName: next.profile.firstName ?? "",
      lastName: next.profile.lastName ?? "",
      displayName: next.profile.displayName ?? "",
      preferredLanguage: next.profile.preferredLanguage,
      preferredCurrency: next.profile.preferredCurrency,
    });
    setPhone(next.phone?.displayPhone ?? "");
  }, [accountQuery.data]);

  const profileMutation = trpc.account.updateProfile.useMutation({ onSuccess: () => { toast.success("Profile saved"); utils.account.get.invalidate(); } });
  const phoneMutation = trpc.account.updatePhone.useMutation({ onSuccess: () => { toast.success("Phone saved; verification is still required"); utils.account.get.invalidate(); } });
  const addressMutation = trpc.account.addresses.create.useMutation({ onSuccess: () => { toast.success("Address saved"); setAddress(emptyAddress); setShowAddressForm(false); utils.account.get.invalidate(); } });
  const deleteMutation = trpc.account.addresses.delete.useMutation({ onSuccess: () => { toast.success("Address removed"); utils.account.get.invalidate(); } });
  const defaultMutation = trpc.account.addresses.setDefault.useMutation({ onSuccess: () => { toast.success("Default address updated"); utils.account.get.invalidate(); } });

  if (loading || (isAuthenticated && accountQuery.isLoading)) return <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7]"><Loader2 className="animate-spin text-[#e53935]" /></div>;
  if (!isAuthenticated) return <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] p-6"><div className="w-full max-w-md bg-white p-8 text-center shadow-sm"><UserRound className="mx-auto mb-4 text-[#e53935]" size={32} /><h1 className="text-2xl font-black">Sign in to your account</h1><p className="mt-2 text-sm text-[#65717d]">Manage your profile, phone number, and delivery addresses.</p><button onClick={() => startLogin()} className="mt-6 bg-[#e53935] px-5 py-3 text-sm font-black text-white">Sign in</button></div></div>;

  const saveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    profileMutation.mutate(profile);
  };
  const savePhone = (event: React.FormEvent) => {
    event.preventDefault();
    phoneMutation.mutate({ phone, countryCode: "KE" });
  };
  const saveAddress = (event: React.FormEvent) => {
    event.preventDefault();
    addressMutation.mutate({ ...address, latitude: address.latitude ? Number(address.latitude) : null, longitude: address.longitude ? Number(address.longitude) : null });
  };
  const updateAddressField = (field: keyof typeof emptyAddress, value: string | boolean) => setAddress((current) => ({ ...current, [field]: value }));

  return <div className="min-h-screen bg-[#f4f5f7] text-[#222b38]">
    <header className="border-b border-[#e1e4e7] bg-white"><div className="mx-auto flex max-w-[1180px] items-center justify-between px-4 py-4 sm:px-6"><div className="flex items-center gap-4"><Link href="/" className="flex items-center gap-2 text-sm font-black text-[#e53935]"><ArrowLeft size={17} /> Back to SokoMart</Link><Link href="/orders" className="text-sm font-bold text-[#56616c]">My orders</Link></div><div className="flex items-center gap-4 text-sm font-bold"><span className="hidden text-[#65717d] sm:inline">{user?.name ?? "My account"}</span><button onClick={() => logout()} className="text-[#e53935]">Sign out</button></div></div></header>
    <main className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6"><div className="mb-7"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#e53935]">Customer account</p><h1 className="mt-1 text-3xl font-black tracking-[-0.06em]">Your SokoMart account</h1><p className="mt-2 text-sm text-[#65717d]">Keep your delivery details ready for future orders.</p></div>
      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="bg-white p-5 shadow-sm"><div className="mb-5 flex items-center gap-3"><UserRound className="text-[#e53935]" size={20} /><div><h2 className="font-black">Profile</h2><p className="text-xs text-[#7a858f]">Your identity stays with OAuth.</p></div></div><form onSubmit={saveProfile} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">First name<input value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} className="mt-1 w-full border border-[#d9dee3] px-3 py-2.5 text-sm outline-none focus:border-[#e53935]" /></label><label className="text-xs font-bold">Last name<input value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} className="mt-1 w-full border border-[#d9dee3] px-3 py-2.5 text-sm outline-none focus:border-[#e53935]" /></label></div><label className="block text-xs font-bold">Display name<input value={profile.displayName} onChange={(e) => setProfile({ ...profile, displayName: e.target.value })} className="mt-1 w-full border border-[#d9dee3] px-3 py-2.5 text-sm outline-none focus:border-[#e53935]" placeholder={user?.name ?? "How should we call you?"} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Language<select value={profile.preferredLanguage} onChange={(e) => setProfile({ ...profile, preferredLanguage: e.target.value })} className="mt-1 w-full border border-[#d9dee3] bg-white px-3 py-2.5 text-sm"><option value="en">English</option><option value="sw">Kiswahili</option></select></label><label className="text-xs font-bold">Currency<select value={profile.preferredCurrency} onChange={(e) => setProfile({ ...profile, preferredCurrency: e.target.value })} className="mt-1 w-full border border-[#d9dee3] bg-white px-3 py-2.5 text-sm"><option value="KES">KES</option><option value="USD">USD</option></select></label></div><button disabled={profileMutation.isPending} className="inline-flex items-center gap-2 bg-[#e53935] px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><Save size={16} /> {profileMutation.isPending ? "Saving..." : "Save profile"}</button></form>
          <div className="mt-8 border-t border-[#eef0f2] pt-5"><div className="mb-3 flex items-center gap-3"><Phone className="text-[#e53935]" size={19} /><div><h2 className="font-black">Phone number</h2><p className="text-xs text-[#7a858f]">Stored in international format. Entry is not verification.</p></div></div><form onSubmit={savePhone} className="flex gap-2"><input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx or +254..." className="min-w-0 flex-1 border border-[#d9dee3] px-3 py-2.5 text-sm outline-none focus:border-[#e53935]" /><button disabled={phoneMutation.isPending} className="bg-[#26323e] px-4 py-2.5 text-sm font-black text-white">Save</button></form>{accountQuery.data?.phone && <p className="mt-2 text-xs text-[#7a858f]">Verification status: {accountQuery.data.phone.verifiedAt ? "verified" : "not verified"}</p>}</div>
        </section>
        <section className="bg-white p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-3"><MapPin className="text-[#e53935]" size={20} /><div><h2 className="font-black">Delivery addresses</h2><p className="text-xs text-[#7a858f]">Saved for future checkout.</p></div></div><button onClick={() => setShowAddressForm((value) => !value)} className="bg-[#e53935] px-3 py-2 text-xs font-black text-white">{showAddressForm ? "Close" : "Add address"}</button></div>
          {showAddressForm && <form onSubmit={saveAddress} className="mb-5 space-y-3 border border-[#f0d5d5] bg-[#fffafa] p-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="Recipient name" value={address.recipientName} onChange={(v) => updateAddressField("recipientName", v)} required /><Field label="Recipient phone" value={address.recipientPhone} onChange={(v) => updateAddressField("recipientPhone", v)} required /></div><div className="grid gap-3 sm:grid-cols-3"><Field label="Country" value={address.country} onChange={(v) => updateAddressField("country", v)} required /><Field label="County" value={address.county} onChange={(v) => updateAddressField("county", v)} required /><Field label="Town / city" value={address.town} onChange={(v) => updateAddressField("town", v)} required /></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Area / neighborhood" value={address.neighborhood} onChange={(v) => updateAddressField("neighborhood", v)} required /><Field label="Estate / building" value={address.estateBuilding} onChange={(v) => updateAddressField("estateBuilding", v)} /></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Apartment / house" value={address.apartmentHouse} onChange={(v) => updateAddressField("apartmentHouse", v)} /><Field label="Street / road" value={address.streetRoad} onChange={(v) => updateAddressField("streetRoad", v)} /></div><label className="block text-xs font-bold">Directions<textarea value={address.directions} onChange={(e) => updateAddressField("directions", e.target.value)} className="mt-1 min-h-20 w-full border border-[#d9dee3] px-3 py-2 text-sm" /></label><div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={address.isDefault} onChange={(e) => updateAddressField("isDefault", e.target.checked)} /> Make default address</label><label className="text-xs font-bold">Label<select value={address.label} onChange={(e) => updateAddressField("label", e.target.value)} className="ml-2 border border-[#d9dee3] bg-white px-2 py-2"><option value="home">Home</option><option value="work">Work</option><option value="other">Other</option></select></label><button disabled={addressMutation.isPending} className="bg-[#26323e] px-4 py-2.5 text-sm font-black text-white">{addressMutation.isPending ? "Saving..." : "Save address"}</button></div></form>}
          <div className="space-y-3">{accountQuery.data?.addresses.length ? accountQuery.data.addresses.map((item) => <div key={item.id} className="border border-[#e4e7ea] p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black uppercase tracking-wide text-[#e53935]">{item.label}</span>{item.isDefault === 1 && <span className="inline-flex items-center gap-1 bg-[#e8f6ee] px-2 py-1 text-[10px] font-black text-[#21834b]"><Check size={12} /> Default</span>}</div><p className="mt-2 text-sm font-black">{item.recipientName} · {item.recipientPhone}</p><p className="mt-1 text-sm text-[#4f5b66]">{item.neighborhood}, {item.town}, {item.county}, {item.country}</p><p className="text-xs text-[#7a858f]">{[item.estateBuilding, item.apartmentHouse, item.streetRoad].filter(Boolean).join(" · ")}</p></div><div className="flex shrink-0 gap-2">{item.isDefault !== 1 && <button onClick={() => defaultMutation.mutate({ addressId: item.id })} className="text-xs font-bold text-[#e53935]">Set default</button>}<button aria-label="Remove address" onClick={() => deleteMutation.mutate({ addressId: item.id })} className="text-[#9aa3ad] hover:text-[#e53935]"><Trash2 size={17} /></button></div></div></div>) : <div className="border border-dashed border-[#ccd2d8] p-8 text-center text-sm text-[#7a858f]">No saved addresses yet. Add one for faster future checkout.</div>}</div>
        </section>
      </div>
    </main>
  </div>;
}

function Field({ label, value, onChange, required = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block text-xs font-bold">{label}<input required={required} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full border border-[#d9dee3] px-3 py-2.5 text-sm outline-none focus:border-[#e53935]" /></label>;
}
