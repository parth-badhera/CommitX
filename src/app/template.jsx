// Re-mounts on every navigation → a gentle fade between pages
export default function Template({ children }) {
  return <div className="animate-page">{children}</div>;
}
