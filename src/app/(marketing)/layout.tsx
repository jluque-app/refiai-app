import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import StructuredData from "@/components/StructuredData";

export default function MarketingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <StructuredData />
            <Navbar />
            <main className="min-h-screen">
                {children}
            </main>
            <Footer />
        </>
    );
}
