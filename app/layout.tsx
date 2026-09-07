import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Frame · Shortform Studio',description:'상품의 이야기를 짧고 선명하게',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>;}
