import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: { default: 'TalentLedger', template: '%s · TalentLedger' },
  description: 'A lightweight CRM for recruitment agencies.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="brand">
              <span className="brand-mark">TL</span> TalentLedger
            </div>
            <Nav />
            <div className="sidebar-foot">Signed in as Priya Raman<br />Demo data · fictional</div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
