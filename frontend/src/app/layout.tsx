import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:{default:'CodePlayers Market — Little finds, big joy',template:'%s | CodePlayers Market'},description:'A student-built shopping demo with MongoDB inventory reservations and Bharat Lite Mode.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
