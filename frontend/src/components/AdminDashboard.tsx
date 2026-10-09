'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api,money} from '@/lib/browser';
type Product={id:string;title:string;sku:string;pricePaise:number;active:boolean;available:number};
export default function AdminDashboard(){
 const [stats,setStats]=useState<{products:number;users:number;orders:number}|null>(null);
 const [products,setProducts]=useState<Product[]>([]),[orders,setOrders]=useState<any[]>([]);
 const [page,setPage]=useState(1),[more,setMore]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [q,setQ]=useState(''),[search,setSearch]=useState('');
 useEffect(()=>{api<any>('/admin/stats').then(setStats).catch(e=>setError(e.message));api<{items:any[]}>('/admin/orders').then(x=>setOrders(x.items)).catch(e=>setError(e.message));},[]);
 useEffect(()=>{let live=true;api<{items:Product[];hasMore:boolean}>('/admin/products?page='+page+'&q='+encodeURIComponent(search)).then(x=>{if(live){setProducts(x.items);setMore(x.hasMore);}}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[page,search]);
 async function save(e:React.FormEvent<HTMLFormElement>,p:Product){e.preventDefault();setBusy(true);setError('');const form=new FormData(e.currentTarget);try{const updated=await api<Product>('/admin/products/'+p.id,'PATCH',{pricePaise:Math.round(Number(form.get('price'))*100),active:form.get('active')==='on'});setProducts(items=>items.map(x=>x.id===p.id?updated:x));setError('Product saved.');}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 return <main className="admin-page"><Link href="/">← Back to shop</Link><h1>Admin dashboard</h1><p>Catalogue management · Protected by role and phone OTP</p><div className="admin-stats">{stats&&Object.entries(stats).map(([k,v])=><div className="panel" key={k}><h2>{v}</h2><span>{k}</span></div>)}</div><p role="status">{error}</p>
 <h2>Products</h2><form className="admin-search" onSubmit={e=>{e.preventDefault();setPage(1);setSearch(q);}}><input aria-label="Search catalogue" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search title or category"/><button className="primary">Search</button></form>
 <div className="admin-products">{products.map(p=><form className="panel" key={p.id+':'+p.pricePaise+':'+p.active} onSubmit={e=>save(e,p)}><h3>{p.title}</h3><p>{p.sku} · Available: {p.available}</p><label>Price (₹)<input name="price" type="number" min="0" max="1000000" step="0.01" required defaultValue={(p.pricePaise/100).toFixed(2)}/></label><label><input type="checkbox" name="active" defaultChecked={p.active}/> Visible in shop</label><button className="primary" disabled={busy}>Save product</button></form>)}</div><div className="admin-search"><button disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page}</span><button disabled={!more} onClick={()=>setPage(page+1)}>Next</button></div>
 <h2>Recent orders</h2><p>Latest 50 orders. All payments are simulated.</p><div className="admin-table"><table><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td>{o.id}</td><td>{new Date(o.createdAt).toLocaleString()}</td><td>{money(o.totalPaise)}</td><td>{o.status}</td></tr>)}</tbody></table></div>{orders.length===0&&<p>No orders yet.</p>}</main>;
}
