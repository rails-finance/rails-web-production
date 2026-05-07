import { SiteNavigation } from "@/components/site/SiteNavigation";
import { SiteFooter } from "@/components/site/SiteFooter";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-rb-50 dark:bg-rb-950 text-foreground z-50 overflow-auto min-w-[320px]">
      <div className="absolute top-0 left-0 right-0 z-50">
        <SiteNavigation />
      </div>
      <main className="relative">{children}</main>
      <SiteFooter />
    </div>
  );
}
