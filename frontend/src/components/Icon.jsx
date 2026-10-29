const paths = {
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
  moon: <path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z"/>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  list: <><path d="M8 6h12M8 12h12M8 18h12"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/></>,
  chat: <><path d="M21 11a8 8 0 0 1-8 8H8l-5 3V11a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/><path d="m11 7 1.5 3 3 1.5-3 1.5L11 16l-1.5-3L6 11.5l3.5-1.5Z"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  logout: <><path d="M9 3H4v18h5M9 12h12m-5-5 5 5-5 5"/></>,
};
export default function Icon({name,size=20}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.list}</svg>;
}
