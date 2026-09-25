import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="empty">
      <h1>Not found</h1>
      <p>That record doesn't exist or was erased.</p>
      <Link className="btn" href="/">Back to dashboard</Link>
    </div>
  );
}
