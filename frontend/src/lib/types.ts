export type Product = { id: string; slug: string; title: string; category: string; description: string; pricePaise: number; image: string; imageLite: string; color: string; sku: string; available: number; demo: boolean; catalogue?: {brand:string;subcategory:string;rating:number;reviewCount:number;originalPricePaise:number;sellerName:string;sellerLocation?:string|null;material:string;sizes:string;returnPolicy:string;deliveryTime:string;availabilityLabel:string} };
export type User = { id: string; name: string; email: string; role:'user'|'admin'; phoneVerified:boolean };
export type Cart = { version: number; items: { sku: string; quantity: number; product: Product | null }[] };
export type Address = { name: string; phone: string; line: string; city: string; pincode: string };
export type Line = { sku: string; title: string; quantity: number; unitPricePaise: number; image: string };
export type Quote = { lines: Line[]; subtotalPaise: number; shippingPaise: number; totalPaise: number; currency: 'INR'; quoteHash: string; cartVersion: number };
export type Checkout = { id: string; status: string; expiresAt: string; serverTime: string; orderId: string | null; quote: Quote; address: Address };
export type Order = { id: string; checkoutId: string; lines: Line[]; totalPaise: number; createdAt: string; address: Address; status: string; paymentMode: string };
