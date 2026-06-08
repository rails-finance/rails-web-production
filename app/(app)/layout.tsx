import { AppFooter } from "@/components/AppFooter";
import { PriceStripProvider } from "@/components/shared/price-strip";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PriceStripProvider>
      <main className="max-w-7xl mx-auto px-4 md:px-6">{children}</main>
      <AppFooter />
    </PriceStripProvider>
  );
}
