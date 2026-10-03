import "./globals.css";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import { Web3Provider } from "@/context/Web3Context";
import { AuthProvider } from "@/context/AuthContext";
import { InvitationsProvider } from "@/context/InvitationsContext";
import { ToastProvider } from "@/context/ToastContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { TransactionModal } from "@/components/web3/TransactionModal";
import { AuthModal } from "@/components/auth/AuthModal";
import { InvitationsModal } from "@/components/invitations/InvitationsModal";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "CommitX — Stake on yourself", template: "%s · CommitX" },
  description:
    "Put ETH behind your goals. Prove your progress, get verified by peers, and withdraw your stake plus rewards on-chain.",
  openGraph: {
    title: "CommitX — Stake on yourself",
    description: "Put ETH behind your goals. Prove progress, get verified, get paid.",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#09090B",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`dark ${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the saved accent colour before first paint (no flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var a=localStorage.getItem("cx_accent");if(a)document.documentElement.dataset.accent=a}catch(e){}`,
          }}
        />
      </head>
      <body className="flex flex-col min-h-screen pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <ToastProvider>
          <Web3Provider>
            <AuthProvider>
              <InvitationsProvider>
                <ProfileProvider>
                  <Navbar />
                  <main className="flex-grow">{children}</main>
                  <Footer />
                  <TransactionModal />
                  <AuthModal />
                  <InvitationsModal />
                </ProfileProvider>
              </InvitationsProvider>
            </AuthProvider>
          </Web3Provider>
        </ToastProvider>
      </body>
    </html>
  );
}
