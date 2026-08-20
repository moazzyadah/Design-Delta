import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design Delta",
  description:
    "Your county's legal HVAC design-temperature ceiling vs. what your block actually measures — powered by FortyGuard hyperlocal temperature data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0b1220", color: "#e8edf6" }}>
        {children}
      </body>
    </html>
  );
}
