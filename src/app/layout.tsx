import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Poly'sen",
  description: "Le marché de prédiction entre potes. Pour de faux, mais pour de vrai.",
  appleWebApp: { capable: true, title: "Poly'sen", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#0f1b2d",
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-28 lg:px-8 lg:pb-12">{children}</main>
      </body>
    </html>
  );
}
