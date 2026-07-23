import "./globals.css";
import { Fraunces, Inter } from "next/font/google";
import { getSettings } from "@/lib/content";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["opsz"],
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  metadataBase: new URL("https://lanternbarn.com"),
  title: {
    default: "Lantern Barn — Coffee & Community in Bridgewater, Vermont",
    template: "%s · Lantern Barn",
  },
  description:
    "A restored barn and gathering place on the Ottauquechee in Bridgewater, Vermont. Coffee, riverside seating, events, and local makers.",
  openGraph: {
    title: "Lantern Barn",
    description:
      "Coffee, community & good company on the river in Bridgewater, Vermont.",
    type: "website",
  },
};

export default async function RootLayout({ children }) {
  const settings = await getSettings();
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Header settings={settings} />
        <main className="flex-1">{children}</main>
        <Footer settings={settings} />
      </body>
    </html>
  );
}
