import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Synapse.PL",
  description: "FPGA-Accelerated Alzheimer Diagnostic Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash: sets data-theme from localStorage before first paint,
            preventing a white-flash when the user has light mode saved. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('synapse-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
