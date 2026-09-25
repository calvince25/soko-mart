import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { toast } from "sonner";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  UserRound,
  X,
  Zap,
} from "lucide-react";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  badge?: string;
  seller: string;
  image: string;
  tone: string;
};

type CartItem = Product & { quantity: number };

const products: Product[] = [
  {
    id: 1,
    name: "Mobicel R6 Pro Smartphone",
    category: "Phones & Tech",
    price: 12999,
    oldPrice: 15999,
    rating: 4.8,
    reviews: 124,
    badge: "Top pick",
    seller: "Nairobi Tech Hub",
    image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=900&q=85&auto=format&fit=crop",
    tone: "#e2f2ee",
  },
  {
    id: 2,
    name: "Everyday Court Sneakers",
    category: "Fashion",
    price: 2499,
    oldPrice: 3299,
    rating: 4.7,
    reviews: 86,
    badge: "-24%",
    seller: "Nia Streetwear",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=900&q=85&auto=format&fit=crop",
    tone: "#fce9dc",
  },
  {
    id: 3,
    name: "Compact Air Fryer 4.5L",
    category: "Home & Kitchen",
    price: 5499,
    oldPrice: 6999,
    rating: 4.6,
    reviews: 52,
    badge: "Flash deal",
    seller: "Luxe Home Kenya",
    image: "https://images.unsplash.com/photo-1585515320310-259814833e62?w=900&q=85&auto=format&fit=crop",
    tone: "#f6efca",
  },
  {
    id: 4,
    name: "Glow Ritual Skincare Set",
    category: "Beauty",
    price: 1890,
    rating: 4.9,
    reviews: 201,
    badge: "Bestseller",
    seller: "Soko Beauty Co.",
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=900&q=85&auto=format&fit=crop",
    tone: "#f4e5ea",
  },
  {
    id: 5,
    name: "Wireless Studio Headphones",
    category: "Phones & Tech",
    price: 3799,
    oldPrice: 4499,
    rating: 4.5,
    reviews: 74,
    badge: "-16%",
    seller: "Nairobi Tech Hub",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&q=85&auto=format&fit=crop",
    tone: "#e7e8f4",
  },
  {
    id: 6,
    name: "Rattan Glow Table Lamp",
    category: "Home & Kitchen",
    price: 2199,
    rating: 4.7,
    reviews: 39,
    seller: "Maji Living",
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=900&q=85&auto=format&fit=crop",
    tone: "#f3ead9",
  },
  {
    id: 7,
    name: "The Carry-All Canvas Tote",
    category: "Fashion",
    price: 1290,
    rating: 4.8,
    reviews: 67,
    badge: "New in",
    seller: "Nia Streetwear",
    image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=900&q=85&auto=format&fit=crop",
    tone: "#e6eee7",
  },
  {
    id: 8,
    name: "Cloudline Accent Chair",
    category: "Home & Kitchen",
    price: 14500,
    oldPrice: 16999,
    rating: 4.6,
    reviews: 21,
    badge: "Room refresh",
    seller: "Maji Living",
    image: "https://images.unsplash.com/photo-1503602642458-232111445657?w=900&q=85&auto=format&fit=crop",
    tone: "#eee8dc",
  },
];

const categories = [
  { name: "Phones & Tech", emoji: "◉", color: "#dff4ed" },
  { name: "Fashion", emoji: "✦", color: "#fbe5d8" },
  { name: "Home & Kitchen", emoji: "⌂", color: "#f4edc9" },
  { name: "Beauty", emoji: "✿", color: "#f3e1e8" },
  { name: "Groceries", emoji: "+", color: "#e5edf5" },
  { name: "Kids & Toys", emoji: "☆", color: "#eee6f5" },
];

const money = (value: number) => `KES ${value.toLocaleString("en-KE")}`;

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = activeCategory === "All" || product.category === activeCategory;
      const matchesQuery = !normalized || `${product.name} ${product.category} ${product.seller}`.toLowerCase().includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, query]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const addToCart = (product: Product, quantity = 1) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...current, { ...product, quantity }];
    });
    setCartOpen(true);
    toast.success(`${product.name} added to your bag`, { description: "You can review it before checkout." });
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart((current) => current.flatMap((item) => {
      if (item.id !== id) return [item];
      const quantity = item.quantity + delta;
      return quantity > 0 ? [{ ...item, quantity }] : [];
    }));
  };

  const toggleWishlist = (product: Product) => {
    setWishlist((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id]);
    toast(wishlist.includes(product.id) ? "Removed from wishlist" : "Saved to wishlist", { description: product.name });
  };

  const chooseCategory = (category: string) => {
    setActiveCategory(category);
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#f8f7f2] text-[#172b3a] selection:bg-[#f5b544] selection:text-[#172b3a]">
      <div className="bg-[#123c43] px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-[#f7dd8a] sm:text-xs">
        Free delivery on orders over KES 3,000 · made for the way Kenya shops
      </div>

      <header className="sticky top-0 z-40 border-b border-[#dfe7e0]/80 bg-[#f8f7f2]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-4 sm:gap-6 sm:px-8 lg:px-12">
          <button aria-label="Open menu" onClick={() => setMobileMenu(true)} className="rounded-full p-2 transition hover:bg-[#e7eee8] lg:hidden">
            <Menu size={22} />
          </button>
          <a href="#top" className="group flex shrink-0 items-center gap-2" aria-label="SokoMart home">
            <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#ff6b35] text-xl font-black text-white shadow-[4px_4px_0_#123c43] transition group-hover:-translate-y-0.5 group-hover:shadow-[5px_6px_0_#123c43]">S</span>
            <span className="hidden text-[21px] font-black tracking-[-0.06em] text-[#123c43] sm:block">sokomart<span className="text-[#ff6b35]">.</span></span>
          </a>

          <nav className="hidden items-center gap-6 pl-4 text-sm font-bold lg:flex">
            <button onClick={() => chooseCategory("All")} className="hover:text-[#ff6b35]">Shop</button>
            <button onClick={() => chooseCategory("Fashion")} className="hover:text-[#ff6b35]">Fashion</button>
            <button onClick={() => chooseCategory("Phones & Tech")} className="hover:text-[#ff6b35]">Phones & Tech</button>
            <button onClick={() => toast("Seller marketplace coming soon", { description: "Soon you’ll be able to open your SokoMart shop." })} className="hover:text-[#ff6b35]">Sell on SokoMart</button>
          </nav>

          <div className="relative ml-auto flex min-w-0 flex-1 items-center sm:max-w-[390px] lg:ml-5 lg:max-w-[450px]">
            <Search className="pointer-events-none absolute left-4 text-[#69807d]" size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for anything good..." className="h-11 w-full rounded-full border border-[#dce8df] bg-white pl-11 pr-4 text-sm font-medium outline-none ring-[#ff6b35] transition placeholder:text-[#8b9c99] focus:ring-2" />
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button onClick={() => isAuthenticated ? logout() : startLogin()} className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-bold hover:bg-[#e7eee8] sm:flex">
              <UserRound size={19} />
              <span>{isAuthenticated ? (user?.name?.split(" ")[0] || "Account") : "Sign in"}</span>
            </button>
            <button aria-label="Wishlist" onClick={() => toast(`${wishlist.length} saved item${wishlist.length === 1 ? "" : "s"}`, { description: "Your wishlist is ready for your next browse." })} className="relative rounded-full p-2.5 transition hover:bg-[#e7eee8]">
              <Heart size={20} strokeWidth={2.2} />
              {wishlist.length > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff6b35] px-1 text-[10px] font-black text-white">{wishlist.length}</span>}
            </button>
            <button aria-label="Open shopping bag" onClick={() => setCartOpen(true)} className="relative rounded-full bg-[#123c43] p-2.5 text-white transition hover:bg-[#ff6b35]">
              <ShoppingBag size={19} />
              {cartCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f5b544] px-1 text-[10px] font-black text-[#123c43]">{cartCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto grid max-w-[1440px] gap-5 px-4 pb-12 pt-5 sm:px-8 sm:pt-8 lg:grid-cols-[1.02fr_0.98fr] lg:px-12 lg:pb-20">
          <div className="relative flex min-h-[475px] flex-col justify-between overflow-hidden rounded-[28px] bg-[#f5b544] p-7 sm:p-10 lg:min-h-[560px] lg:p-14">
            <div className="absolute -right-20 top-16 h-72 w-72 rounded-full border-[28px] border-[#f9cc6b]/70 lg:h-96 lg:w-96" />
            <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-[#ff7d45]/40" />
            <div className="relative z-10 flex items-center justify-between text-xs font-black uppercase tracking-[0.18em] text-[#123c43]">
              <span className="flex items-center gap-2"><Sparkles size={15} /> SokoMart edit 01</span>
              <span>Kenya / 2026</span>
            </div>
            <div className="relative z-10 max-w-[560px]">
              <p className="mb-4 text-sm font-black uppercase tracking-[0.22em] text-[#123c43]/75">Your next good find is here</p>
              <h1 className="max-w-[580px] text-[clamp(3.4rem,7vw,6.8rem)] font-black leading-[0.86] tracking-[-0.085em] text-[#123c43]">More good<br /><span className="italic">stuff.</span><br />More life.</h1>
              <p className="mt-7 max-w-[390px] text-base font-medium leading-relaxed text-[#123c43]/80 sm:text-lg">A brighter marketplace for everyday essentials, small luxuries, and the things you didn’t know you needed.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => chooseCategory("All")} className="group inline-flex items-center gap-3 rounded-full bg-[#123c43] px-5 py-3.5 text-sm font-black text-white transition hover:bg-[#ff6b35]">Shop the edit <ArrowRight size={17} className="transition group-hover:translate-x-1" /></button>
                <button onClick={() => toast("SokoMart picks are curated weekly", { description: "Check back for more finds from Kenyan sellers." })} className="rounded-full border-2 border-[#123c43]/30 px-5 py-3.5 text-sm font-black text-[#123c43] transition hover:border-[#123c43]">Why SokoMart?</button>
              </div>
            </div>
            <div className="relative z-10 flex items-end justify-between pt-10">
              <div className="flex -space-x-2">
                {["#ff6b35", "#123c43", "#e5edf5", "#f4e1dc"].map((color, index) => <span key={color} className="h-8 w-8 rounded-full border-2 border-[#f5b544]" style={{ backgroundColor: color, zIndex: 4 - index }} />)}
              </div>
              <p className="max-w-[170px] text-right text-xs font-bold leading-relaxed text-[#123c43]/70">Loved by thousands of shoppers across Kenya</p>
            </div>
          </div>

          <div className="grid min-h-[475px] grid-cols-2 gap-5 lg:min-h-[560px]">
            <div className="relative col-span-2 min-h-[245px] overflow-hidden rounded-[28px] bg-[#e3efe8] sm:min-h-[280px]">
              <img src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200&q=85&auto=format&fit=crop" alt="Person shopping online" className="absolute inset-0 h-full w-full object-cover mix-blend-multiply opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#123c43]/80 via-[#123c43]/20 to-transparent" />
              <div className="relative flex h-full flex-col justify-end p-7 text-white sm:p-9">
                <span className="mb-auto w-fit rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] backdrop-blur-sm">The fresh drop</span>
                <h2 className="max-w-[320px] text-3xl font-black leading-[0.95] tracking-[-0.06em] sm:text-4xl">Little upgrades.<br />Big mood.</h2>
                <button onClick={() => chooseCategory("Home & Kitchen")} className="mt-4 flex w-fit items-center gap-2 text-sm font-black hover:text-[#f5b544]">Browse home <ArrowRight size={16} /></button>
              </div>
            </div>
            <button onClick={() => chooseCategory("Fashion")} className="group relative overflow-hidden rounded-[28px] bg-[#e9dff0] text-left transition hover:-translate-y-1">
              <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800&q=85&auto=format&fit=crop" alt="Fashion shopping" className="absolute inset-0 h-full w-full object-cover mix-blend-multiply opacity-80 transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#482b54]/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 p-6 text-white sm:p-7"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#f5d58e]">Fresh looks</p><h3 className="mt-2 text-2xl font-black tracking-[-0.05em]">Wear your<br />own vibe.</h3></div>
            </button>
            <button onClick={() => chooseCategory("Phones & Tech")} className="group relative overflow-hidden rounded-[28px] bg-[#dcebf0] text-left transition hover:-translate-y-1">
              <img src="https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&q=85&auto=format&fit=crop" alt="Modern technology products" className="absolute inset-0 h-full w-full object-cover mix-blend-multiply opacity-70 transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#183f51]/85 via-transparent to-transparent" />
              <div className="absolute bottom-0 p-6 text-white sm:p-7"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9be0cd]">Tech that gets you</p><h3 className="mt-2 text-2xl font-black tracking-[-0.05em]">Plug in.<br />Level up.</h3></div>
            </button>
          </div>
        </section>

        <section className="border-y border-[#dfe7e0] bg-white/60">
          <div className="mx-auto flex max-w-[1440px] items-center gap-6 overflow-x-auto px-4 py-5 sm:gap-10 sm:px-8 lg:px-12">
            <span className="shrink-0 text-xs font-black uppercase tracking-[0.2em] text-[#69807d]">Shop by mood</span>
            {categories.map((category) => <button key={category.name} onClick={() => chooseCategory(category.name)} className="group flex shrink-0 items-center gap-2.5 text-sm font-black hover:text-[#ff6b35]"><span className="flex h-9 w-9 items-center justify-center rounded-full text-lg transition group-hover:scale-110" style={{ backgroundColor: category.color }}>{category.emoji}</span>{category.name}</button>)}
          </div>
        </section>

        <section id="shop" className="mx-auto max-w-[1440px] px-4 pb-20 pt-14 sm:px-8 lg:px-12">
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div><p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-[#ff6b35]">The good stuff</p><h2 className="text-4xl font-black tracking-[-0.07em] text-[#123c43] sm:text-5xl">Right now, we’re into</h2></div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm">
                {['All', 'Deals', 'New in'].map((filter) => <button key={filter} onClick={() => { if (filter === 'All') setActiveCategory('All'); else if (filter === 'Deals') setQuery(''); else setQuery(''); toast(`${filter} collection selected`); }} className={`rounded-full px-3 py-2 text-xs font-black transition ${((filter === 'All' && activeCategory === 'All') || (filter !== 'All' && query === filter)) ? 'bg-[#123c43] text-white' : 'text-[#69807d] hover:text-[#123c43]'}`}>{filter}</button>)}
              </div>
              <button onClick={() => { setActiveCategory('All'); setQuery(''); }} className="hidden rounded-full border border-[#dfe7e0] px-4 py-2.5 text-xs font-black sm:block">Reset</button>
            </div>
          </div>

          {visibleProducts.length > 0 ? <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4 lg:gap-y-12">{visibleProducts.map((product, index) => <article key={product.id} className="group min-w-0" style={{ animationDelay: `${index * 45}ms` }}>
            <div className="relative mb-4 aspect-[0.9] overflow-hidden rounded-[22px]" style={{ backgroundColor: product.tone }}>
              <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover mix-blend-multiply transition duration-500 group-hover:scale-105" />
              {product.badge && <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#123c43] shadow-sm">{product.badge}</span>}
              <button aria-label={`Save ${product.name}`} onClick={() => toggleWishlist(product)} className={`absolute right-3 top-3 rounded-full p-2.5 backdrop-blur-sm transition ${wishlist.includes(product.id) ? 'bg-[#ff6b35] text-white' : 'bg-white/80 text-[#123c43] hover:bg-white'}`}><Heart size={17} fill={wishlist.includes(product.id) ? 'currentColor' : 'none'} /></button>
              <button onClick={() => addToCart(product)} className="absolute bottom-3 left-3 right-3 translate-y-2 rounded-full bg-[#123c43] py-3 text-xs font-black text-white opacity-0 shadow-lg transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-[#ff6b35]">Add to bag</button>
            </div>
            <button onClick={() => setSelectedProduct(product)} className="block w-full text-left"><div className="mb-1 flex items-start justify-between gap-2"><h3 className="text-sm font-black leading-snug tracking-[-0.02em] text-[#172b3a] sm:text-[15px]">{product.name}</h3><span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#69807d]"><Star size={12} fill="#f5b544" strokeWidth={0} />{product.rating}</span></div><p className="mb-2 text-xs font-medium text-[#81928f]">{product.seller}</p><div className="flex items-center gap-2"><span className="text-sm font-black text-[#123c43]">{money(product.price)}</span>{product.oldPrice && <span className="text-xs font-bold text-[#a5b0ad] line-through">{money(product.oldPrice)}</span>}</div></button>
          </article>)}</div> : <div className="rounded-[28px] bg-white p-14 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5b544]"><Search size={25} /></div><h3 className="mt-5 text-2xl font-black tracking-[-0.05em]">No finds yet</h3><p className="mt-2 text-sm text-[#69807d]">Try a different search or browse all the good stuff.</p><button onClick={() => { setQuery(''); setActiveCategory('All'); }} className="mt-5 rounded-full bg-[#123c43] px-5 py-3 text-sm font-black text-white">Show everything</button></div>}
        </section>

        <section className="bg-[#123c43] text-white">
          <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-12 sm:px-8 lg:grid-cols-[1.1fr_2fr] lg:items-center lg:px-12 lg:py-16">
            <div><p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#f5b544]">The SokoMart promise</p><h2 className="max-w-[440px] text-4xl font-black leading-[0.95] tracking-[-0.07em] sm:text-5xl">Good shopping should feel this easy.</h2></div>
            <div className="grid gap-6 sm:grid-cols-3">
              {[{ icon: Truck, title: "Delivery that moves", text: "Reliable delivery from Nairobi to your doorstep." }, { icon: Check, title: "Sellers you can trust", text: "Real stores, real ratings, no guesswork." }, { icon: Zap, title: "M-Pesa ready", text: "Simple checkout, built for Kenya." }].map(({ icon: Icon, title, text }) => <div key={title} className="border-t border-white/20 pt-4"><Icon className="mb-8 text-[#f5b544]" size={22} /><h3 className="mb-2 font-black">{title}</h3><p className="text-sm leading-relaxed text-white/65">{text}</p></div>)}
            </div>
          </div>
        </section>

        <footer className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-8 text-xs font-bold text-[#69807d] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12"><p>© 2026 SokoMart. Made for modern Kenya.</p><div className="flex gap-5"><button onClick={() => toast("Help centre coming soon")}>Help centre</button><button onClick={() => toast("Seller sign-up coming soon")}>Become a seller</button><button onClick={() => toast("Privacy policy coming soon")}>Privacy</button></div></footer>
      </main>

      {mobileMenu && <div className="fixed inset-0 z-50 bg-[#123c43]/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenu(false)}><aside className="h-full w-[84%] max-w-[340px] bg-[#f8f7f2] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#ff6b35] text-xl font-black text-white">S</span><span className="text-[21px] font-black tracking-[-0.06em]">sokomart<span className="text-[#ff6b35]">.</span></span></div><button onClick={() => setMobileMenu(false)} className="rounded-full p-2 hover:bg-[#e7eee8]"><X size={20} /></button></div><div className="mt-12 grid gap-2 text-lg font-black"><button className="rounded-2xl bg-[#e7eee8] p-4 text-left" onClick={() => { setMobileMenu(false); chooseCategory('All'); }}>Shop everything</button>{['Fashion', 'Phones & Tech', 'Home & Kitchen', 'Beauty'].map((item) => <button key={item} className="rounded-2xl p-4 text-left hover:bg-[#e7eee8]" onClick={() => { setMobileMenu(false); chooseCategory(item); }}>{item}</button>)}<button className="mt-6 flex items-center gap-3 rounded-2xl bg-[#123c43] p-4 text-left text-white" onClick={() => { setMobileMenu(false); isAuthenticated ? logout() : startLogin(); }}><UserRound size={19} />{isAuthenticated ? 'Sign out' : 'Sign in'}</button></div></aside></div>}

      {selectedProduct && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#123c43]/40 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={() => setSelectedProduct(null)}><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[28px] bg-[#f8f7f2] p-5 shadow-2xl sm:rounded-[28px] sm:p-7" onClick={(event) => event.stopPropagation()}><div className="mb-5 flex justify-end"><button onClick={() => setSelectedProduct(null)} className="rounded-full bg-white p-2 hover:bg-[#e7eee8]"><X size={19} /></button></div><div className="grid gap-7 sm:grid-cols-2"><div className="aspect-square overflow-hidden rounded-[22px]" style={{ backgroundColor: selectedProduct.tone }}><img src={selectedProduct.image} alt={selectedProduct.name} className="h-full w-full object-cover mix-blend-multiply" /></div><div className="flex flex-col justify-center"><span className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[#ff6b35]">{selectedProduct.category}</span><h2 className="text-3xl font-black leading-none tracking-[-0.06em] sm:text-4xl">{selectedProduct.name}</h2><p className="mt-3 text-sm text-[#69807d]">Sold by {selectedProduct.seller}</p><div className="mt-6 flex items-center gap-3"><span className="text-2xl font-black text-[#123c43]">{money(selectedProduct.price)}</span>{selectedProduct.oldPrice && <span className="text-sm font-bold text-[#a5b0ad] line-through">{money(selectedProduct.oldPrice)}</span>}</div><div className="mt-3 flex items-center gap-2 text-sm font-bold"><span className="flex items-center gap-1"><Star size={15} fill="#f5b544" strokeWidth={0} /> {selectedProduct.rating}</span><span className="text-[#81928f]">({selectedProduct.reviews} reviews)</span></div><p className="mt-7 text-sm leading-relaxed text-[#536965]">A considered everyday essential, selected for its quality, usefulness, and ability to make the ordinary feel a little better.</p><button onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }} className="mt-8 flex items-center justify-center gap-2 rounded-full bg-[#123c43] px-5 py-4 text-sm font-black text-white transition hover:bg-[#ff6b35]">Add to bag <ShoppingBag size={17} /></button><p className="mt-4 text-center text-xs font-bold text-[#69807d]">Free delivery over KES 3,000</p></div></div></div></div>}

      {cartOpen && <div className="fixed inset-0 z-50 bg-[#123c43]/40 backdrop-blur-sm" onClick={() => setCartOpen(false)}><aside className="ml-auto flex h-full w-full max-w-[460px] flex-col bg-[#f8f7f2] p-5 shadow-2xl sm:p-7" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between border-b border-[#dfe7e0] pb-5"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#ff6b35]">Your bag</p><h2 className="mt-1 text-3xl font-black tracking-[-0.07em]">Good choices.</h2></div><button onClick={() => setCartOpen(false)} className="rounded-full bg-white p-2 hover:bg-[#e7eee8]"><X size={20} /></button></div>{cart.length === 0 ? <div className="flex flex-1 flex-col items-center justify-center text-center"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f5b544]"><ShoppingBag size={26} /></div><h3 className="mt-5 text-xl font-black">Your bag is having a quiet moment.</h3><p className="mt-2 max-w-[250px] text-sm leading-relaxed text-[#69807d]">Add a few finds and they’ll show up here.</p><button onClick={() => setCartOpen(false)} className="mt-6 rounded-full bg-[#123c43] px-5 py-3 text-sm font-black text-white">Keep browsing</button></div> : <><div className="flex-1 space-y-5 overflow-y-auto py-6">{cart.map((item) => <div key={item.id} className="flex gap-4"><div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl" style={{ backgroundColor: item.tone }}><img src={item.image} alt={item.name} className="h-full w-full object-cover mix-blend-multiply" /></div><div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><h3 className="text-sm font-black leading-snug">{item.name}</h3><span className="shrink-0 text-sm font-black">{money(item.price * item.quantity)}</span></div><p className="mt-1 text-xs text-[#69807d]">{item.seller}</p><div className="mt-3 flex items-center gap-3"><div className="flex items-center gap-3 rounded-full bg-white px-3 py-1.5"><button onClick={() => updateQuantity(item.id, -1)} className="font-black">−</button><span className="min-w-4 text-center text-xs font-black">{item.quantity}</span><button onClick={() => updateQuantity(item.id, 1)} className="font-black">+</button></div><button onClick={() => setCart((current) => current.filter((cartItem) => cartItem.id !== item.id))} className="text-xs font-bold text-[#ff6b35]">Remove</button></div></div></div>)}</div><div className="border-t border-[#dfe7e0] pt-5"><div className="mb-2 flex justify-between text-sm font-bold text-[#69807d]"><span>Subtotal</span><span>{money(cartTotal)}</span></div><div className="mb-5 flex justify-between text-xl font-black"><span>Total</span><span>{money(cartTotal)}</span></div><button onClick={() => setCheckoutOpen(true)} className="w-full rounded-full bg-[#ff6b35] px-5 py-4 text-sm font-black text-white transition hover:bg-[#123c43]">Continue to checkout</button><p className="mt-3 text-center text-[11px] font-bold text-[#81928f]">M-Pesa and card payments available at launch</p></div></>}</aside></div>}

      {checkoutOpen && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#123c43]/55 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-[28px] bg-[#f8f7f2] p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff6b35]">Checkout preview</p><h2 className="mt-2 text-3xl font-black tracking-[-0.07em]">Almost yours.</h2></div><button onClick={() => setCheckoutOpen(false)} className="rounded-full bg-white p-2 hover:bg-[#e7eee8]"><X size={19} /></button></div><div className="mt-7 rounded-2xl bg-[#e7eee8] p-4 text-sm font-bold"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#123c43] text-white"><Check size={16} /></span><span>Cart saved · {cartCount} item{cartCount === 1 ? '' : 's'} · {money(cartTotal)}</span></div></div><div className="mt-5 grid gap-3"><label className="text-xs font-black uppercase tracking-[0.14em] text-[#69807d]">Delivery location<input placeholder="e.g. Kilimani, Nairobi" className="mt-2 h-12 w-full rounded-xl border border-[#dfe7e0] bg-white px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-[#ff6b35]" /></label><label className="text-xs font-black uppercase tracking-[0.14em] text-[#69807d]">Payment method<button className="mt-2 flex h-12 w-full items-center justify-between rounded-xl border border-[#dfe7e0] bg-white px-4 text-left text-sm font-bold"><span>M-Pesa</span><ChevronDown size={17} /></button></label></div><button onClick={() => { setCheckoutOpen(false); setCartOpen(false); toast.success("Checkout flow is ready for payment integration", { description: "Next step: connect M-Pesa Daraja and delivery pricing." }); }} className="mt-7 w-full rounded-full bg-[#123c43] px-5 py-4 text-sm font-black text-white transition hover:bg-[#ff6b35]">Place demo order</button><p className="mt-3 text-center text-xs font-medium text-[#81928f]">This MVP uses a demo checkout. No payment is processed.</p></div></div>}
    </div>
  );
}
