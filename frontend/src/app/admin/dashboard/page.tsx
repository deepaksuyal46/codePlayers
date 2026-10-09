import {requireAdmin} from '@/lib/auth';
import {AppError} from '@/lib/domain';
import {redirect} from 'next/navigation';
import AdminDashboard from '@/components/AdminDashboard';
export const dynamic='force-dynamic';
export default async function Page(){
 try{await requireAdmin();}catch(e){if(e instanceof AppError&&(e.status===401||e.status===403))redirect('/login');throw e;}
 return <AdminDashboard/>;
}
