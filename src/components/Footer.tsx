import Link from "next/link";

export function Footer() {
    return (
        <footer className="bg-[hsl(var(--surface))] border-t border-[hsl(var(--border))] py-12">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-4">
                        <Link href="/" className="text-xl font-bold tracking-tight">
                            ReFi<span className="text-[hsl(var(--primary))]">AI</span>
                        </Link>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            Master Real Estate Finance and Investment with AI-powered tools and expert curriculum.
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-4">Learn</h3>
                        <ul className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
                            <li><Link href="/courses/real-estate-101" className="hover:text-[hsl(var(--primary))]">Real Estate 101</Link></li>
                            <li><Link href="/courses/refi-core" className="hover:text-[hsl(var(--primary))]">REFI Core</Link></li>
                            <li><Link href="/courses/advanced" className="hover:text-[hsl(var(--primary))]">Advanced Topics</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-4">Company</h3>
                        <ul className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
                            <li><Link href="/about" className="hover:text-[hsl(var(--primary))]">About Instructor</Link></li>
                            <li><Link href="/contact" className="hover:text-[hsl(var(--primary))]">Contact</Link></li>
                            <li><Link href="/privacy" className="hover:text-[hsl(var(--primary))]">Privacy Policy</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="font-semibold mb-4">Connect</h3>
                        <ul className="space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
                            <li><a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-[hsl(var(--primary))]">LinkedIn</a></li>
                            <li><a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-[hsl(var(--primary))]">Twitter</a></li>
                        </ul>
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t border-[hsl(var(--border))] text-center text-sm text-[hsl(var(--muted-foreground))]">
                    © {new Date().getFullYear()} ReFiAI. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
