import { Header } from "@/components/layout/Header";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background">
            <Header />
            <main className="flex-1 p-8">
                {children}
            </main>
        </div>
    );
}
