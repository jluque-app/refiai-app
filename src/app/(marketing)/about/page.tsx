import Image from "next/image";

export default function About() {
    return (
        <div className="container py-16">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold mb-12 text-center tracking-tight">Meet the Instructor</h1>

                <div className="flex flex-col md:flex-row gap-10 items-start">
                    <div className="w-full md:w-1/3 shrink-0">
                        <div className="rounded-2xl overflow-hidden shadow-xl border border-border">
                            <Image
                                src="/jaime_luque.jpg"
                                alt="Jaime Luque"
                                width={400}
                                height={500}
                                className="w-full h-auto object-cover"
                            />
                        </div>
                        <div className="mt-6 text-center md:text-left">
                            <h3 className="text-xl font-bold">Jaime Luque</h3>
                            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold mt-1">
                                ESCP Business School
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Professor of Real Estate
                            </p>
                        </div>
                    </div>

                    <div className="w-full md:w-2/3 prose prose-slate dark:prose-invert max-w-none">
                        <p className="lead">
                            Jaime Luque holds the Government of Monaco’s Real Estate Technology Chair and is a Full Professor of Real Estate at ESCP Business School. He is also the Director of the ESCP Institute of Real Estate Finance and Management. Prior to joining ESCP in July 2018, he was an Assistant Professor of Real Estate at the University of Wisconsin-Madison’s School of Business. He remains a Research Fellow of the University of Wisconsin-Madison’s Center for Financial Security.
                        </p>

                        <p>
                            Beyond academia, Jaime advises governments and companies on real estate finance, housing policy, technology adoption, and capital raising. He serves on the Housing Advisory Board of the European Commission, and as a Board Advisor of Upper Echelon, a global platform connecting investors with capital-seeking entrepreneurs, on its European expansion.
                        </p>

                        <p>
                            Jaime’s teaching specializations include real estate finance and investments, real estate economics, urban economics, and macroeconomics. He has taught in the MBA, MSc and BBA programs. Jaime is the recipient of the 2017 Ideas Worth Teaching Award by The Aspen Institute in the United States for his educational innovations to address affordable housing development.
                        </p>

                        <p>
                            Jaime’s research is known for his work on housing affordability, including subprime mortgage lending, Tax Increment Financing (TIF), Low Income Housing Tax Credits (LIHTC), rent control, and mixed income communities. His book <em>Affordable Housing Development</em> published by Springer provides insights and practical demonstration of important financial tools often necessary to the financial feasibility of affordable housing projects, including TIF and LIHTC.
                        </p>

                        <p>
                            Jaime has also investigated different issues related to repo and rehypothecation, securities pricing and market pressures. This line of research evolved towards the understanding of leverage dynamics, security bubbles, anomalies in currency markets, and banks’ portfolio rebalancing in sovereign debt crises.
                        </p>

                        <p>
                            Jaime’s research has been published in journals such as Journal of Economic Theory, Journal of Public Economics, Economic Theory, Real Estate Economics, and Regional Science and Urban Economics. He has also written opinion pieces for the Financial Times, the Huffington Post, Le Monde, Les Echos, La Repubblica, World Economic Forum, Expansion, El País, El Mundo, El Confidencial, and El Economista, as well as for the Vox.eu, Eurointelligence and The Conversation economics op-ed sites.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
