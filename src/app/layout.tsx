import "./globals.css";
import { Providers } from "./providers";
import { Shell } from "@/components/Shell";

export const metadata = {
  title: "WholeLeaf",
  description: "Charity without trusting a hero. A fund where no one person can pay out money or read a recipient's file: a payout needs 2 of 3 council approvals, enforced by TideCloak.",
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#FFFFFF" };

const FONTS =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Lora:ital,wght@0,500;0,600;0,700;1,400&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
