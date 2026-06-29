"use client";

import { DeckSlide } from "@/components/deck/DeckSlide";
import { Button } from "@/components/ui/button";
import {
    Building2, TrendingUp, AlertTriangle, ShieldCheck,
    Globe2, Users, PieChart, Landmark, ArrowRight, Euro, Search, BarChart3, Scale, Timer, Leaf, Anchor, Lock, RefreshCw, Smartphone
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function FundDeckPage() {
    return (
        <main className="snap-y snap-mandatory h-screen w-full overflow-y-scroll bg-white text-slate-900 scroll-smooth relative font-sans selection:bg-amber-500/30">

            {/* 1. HERO SLIDE - LIGHT MODE */}
            <DeckSlide className="bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat relative">
                <div className="absolute inset-0 bg-white/90" />
                <div className="relative z-10 space-y-8 max-w-[90vw]">
                    <div className="inline-block px-6 py-2 border border-amber-600/30 rounded-full bg-amber-500/10 text-amber-700 text-base font-bold tracking-widest mb-6 uppercase">
                        Institutional Investment Platform
                    </div>
                    <h1 className="text-7xl md:text-9xl font-bold tracking-tighter text-slate-900 leading-[0.9]">
                        Pan-European <br />
                        <span className="text-amber-600">Affordable Housing Fund</span>
                    </h1>
                    <p className="text-2xl md:text-4xl text-slate-600 max-w-5xl leading-tight font-light">
                        A scalable platform for co-investment with <span className="text-slate-900 font-medium">EIB, EIF</span>, and <span className="text-slate-900 font-medium">National Promotional Banks</span>.
                    </p>
                    <div className="pt-12 flex flex-col md:flex-row gap-8 items-start md:items-center">
                        <div className="text-sm text-slate-500 uppercase tracking-widest font-bold">Championed by</div>
                        <div className="flex items-center gap-8">
                            <span className="font-bold text-slate-900 text-2xl border-b-2 border-amber-500 pb-1">Dr. Jaime Luque</span>
                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                            <span className="font-bold text-slate-900 text-2xl border-b-2 border-amber-500 pb-1">Octopus Capital</span>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 2. THE STRUCTURAL GAP */}
            <DeckSlide>
                <div className="grid lg:grid-cols-2 gap-20 items-center w-full">
                    <div className="space-y-10">
                        <h2 className="text-6xl md:text-8xl font-bold leading-none tracking-tight text-slate-900">
                            Europe's <br />
                            <span className="text-red-600">Housing Gap</span>
                        </h2>
                        <div className="border-l-8 border-red-600 pl-8 py-4">
                            <p className="text-3xl md:text-4xl text-slate-700 font-light leading-snug">
                                "Europe must build <span className="text-slate-900 font-bold">1 Million</span> new dwellings per year to close the supply gap."
                            </p>
                            <p className="text-slate-500 mt-4 uppercase tracking-widest text-sm font-bold">— European Investment Bank (EIB) Estimates</p>
                        </div>
                        <p className="text-xl text-slate-600 leading-relaxed max-w-xl">
                            The failure to deliver supply has transformed affordable housing from a market niche into <strong className="text-slate-900">core social infrastructure</strong> required to prevent systemic instability.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-8">
                        <div className="flex flex-col border-b border-slate-200 pb-8">
                            <div className="text-7xl md:text-9xl font-bold text-red-600 mb-2 leading-none">+60.5%</div>
                            <div className="text-lg text-slate-500 uppercase tracking-widest font-bold">EU Housing Price Rise (2015-2025)</div>
                        </div>
                        <div className="flex flex-col border-b border-slate-200 pb-8">
                            <div className="text-7xl md:text-9xl font-bold text-slate-900 mb-2 leading-none">€375B</div>
                            <div className="text-lg text-slate-500 uppercase tracking-widest font-bold">Committed by Promotional Banks</div>
                        </div>
                        <div className="flex flex-col">
                            <div className="text-7xl md:text-9xl font-bold text-amber-600 mb-2 leading-none">75%</div>
                            <div className="text-lg text-slate-500 uppercase tracking-widest font-bold">Poor Energy Performance</div>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 3. EXTREME PRICE INCREASES */}
            <DeckSlide>
                <div className="w-full space-y-16">
                    <div>
                        <h2 className="text-6xl md:text-8xl font-bold mb-6 text-slate-900">Acute Market Distress</h2>
                        <p className="text-3xl text-slate-600 max-w-4xl">
                            Rents increased <span className="text-slate-900 font-bold">28.8%</span>, dramatically outpacing wage growth in every major capital city.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-slate-200 pt-12">
                        {[
                            { country: "Hungary", val: "+237%", color: "text-red-600", note: "Highest Increase" },
                            { country: "Czechia", val: "+155%", color: "text-orange-600", note: "Supply Constraint" },
                            { country: "Portugal", val: "+146%", color: "text-amber-600", note: "Foreign Demand" }
                        ].map((stat) => (
                            <div key={stat.country} className="space-y-2 bg-slate-50 p-8 rounded-xl border border-slate-100 shadow-sm">
                                <div className="text-xl text-slate-500 uppercase tracking-widest font-bold">{stat.country}</div>
                                <div className={`text-7xl font-bold tracking-tighter ${stat.color}`}>{stat.val}</div>
                                <div className="text-sm text-slate-600 font-medium">Price Growth Since 2015</div>
                                <div className="text-xs text-slate-400 mt-2 uppercase tracking-wide">{stat.note}</div>
                            </div>
                        ))}
                    </div>

                    <div className="grid md:grid-cols-3 gap-12 pt-8">
                        <div>
                            <div className="text-5xl font-bold text-slate-900 mb-2">9.8%</div>
                            <div className="text-lg text-slate-600 leading-tight">Urban residents facing <strong className="text-red-600">severe cost burden</strong> ({'>'}40% income).</div>
                        </div>
                        <div>
                            <div className="text-5xl font-bold text-slate-900 mb-2">10%</div>
                            <div className="text-lg text-slate-600 leading-tight">Cannot pay rent or mortgage on time due to liquidity constraints.</div>
                        </div>
                        <div>
                            <div className="text-5xl font-bold text-slate-900 mb-2">15%</div>
                            <div className="text-lg text-slate-600 leading-tight">Are in arrears on utility bills (Energy Poverty).</div>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 4. SUPPLY COLLAPSE */}
            <DeckSlide>
                <div className="grid lg:grid-cols-2 gap-24 items-start w-full">
                    <div className="space-y-12">
                        <h2 className="text-6xl md:text-8xl font-bold leading-none text-slate-900">
                            Supply <br />
                            <span className="text-red-600">Collapse</span>
                        </h2>
                        <div className="space-y-8">
                            <div>
                                <h4 className="text-slate-900 font-bold text-3xl mb-2 flex items-center gap-3"><TrendingUp className="w-8 h-8 text-red-600" /> Cost Surge</h4>
                                <p className="text-slate-600 text-xl max-w-md">Construction costs surged <span className="text-slate-900 font-bold">+56%</span> (2010-2024). Hungary saw +159% labor cost inflation.</p>
                            </div>
                            <div>
                                <h4 className="text-slate-900 font-bold text-3xl mb-2 flex items-center gap-3"><Building2 className="w-8 h-8 text-red-600" /> Activity Freeze</h4>
                                <p className="text-slate-600 text-xl max-w-md">New permits are strictly down, with investment contracting to <span className="text-slate-900 font-bold">32%</span> in 2024.</p>
                            </div>
                            <div>
                                <h4 className="text-slate-900 font-bold text-3xl mb-2 flex items-center gap-3"><AlertTriangle className="w-8 h-8 text-red-600" /> Legacy Stock</h4>
                                <p className="text-slate-600 text-xl max-w-md">85% of buildings predate 2000. Energy poverty affects 8-16% of residents, requiring deep retrofits.</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-12 border-l-4 border-amber-500 h-full flex flex-col justify-center rounded-r-xl shadow-sm">
                        <h3 className="text-3xl font-light mb-8 text-slate-900">The Opportunity</h3>
                        <p className="text-2xl md:text-4xl leading-tight text-slate-700 italic">
                            "EIB, EIF and EBRD strategies explicitly call for <span className="text-amber-600 font-bold not-italic">blended-finance platforms</span> to solve this crisis by delivering long-term affordable rental housing at scale."
                        </p>
                        <div className="mt-12 flex gap-4 opacity-50">
                            <div className="bg-amber-500 h-2 w-full rounded-full opacity-20" />
                            <div className="bg-amber-500 h-2 w-full rounded-full opacity-20" />
                            <div className="bg-amber-500 h-2 w-full rounded-full opacity-40" />
                            <div className="bg-amber-500 h-2 w-full rounded-full" />
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 5. STRATEGIC ALIGNMENT */}
            <DeckSlide>
                <h2 className="text-5xl md:text-7xl font-bold mb-6 text-slate-900">Strategic Alignment</h2>
                <p className="text-2xl text-slate-600 max-w-4xl mb-16">
                    Designed to meet the specific requirements of European promotional banks for co-investment.
                </p>
                <div className="grid md:grid-cols-3 gap-12 w-full">
                    <div className="group space-y-6 bg-white p-8 rounded-xl border border-slate-200 hover:shadow-xl transition-shadow">
                        <div className="text-8xl font-bold text-blue-900 group-hover:text-blue-600 transition-colors">EIB</div>
                        <div className="h-1 w-20 bg-blue-600" />
                        <h4 className="text-lg font-bold text-slate-900 uppercase tracking-widest">European Investment Bank</h4>
                        <ul className="space-y-4 text-xl text-slate-600">
                            <li>• Supports Housing Action Plan (2025-2027).</li>
                            <li>• Senior long-term financing.</li>
                            <li>• Soft-loan eligibility.</li>
                            <li>• Green Bond framework aligned.</li>
                        </ul>
                    </div>
                    <div className="group space-y-6 bg-white p-8 rounded-xl border border-slate-200 hover:shadow-xl transition-shadow">
                        <div className="text-8xl font-bold text-blue-900 group-hover:text-blue-500 transition-colors">EIF</div>
                        <div className="h-1 w-20 bg-blue-500" />
                        <h4 className="text-lg font-bold text-slate-900 uppercase tracking-widest">European Investment Fund</h4>
                        <ul className="space-y-4 text-xl text-slate-600">
                            <li>• Aligned with social-investment mandates.</li>
                            <li>• First-loss participation.</li>
                            <li>• InvestEU guarantees.</li>
                            <li>• Equity co-investment ready.</li>
                        </ul>
                    </div>
                    <div className="group space-y-6 bg-white p-8 rounded-xl border border-slate-200 hover:shadow-xl transition-shadow">
                        <div className="text-8xl font-bold text-blue-900 group-hover:text-amber-500 transition-colors">EBRD</div>
                        <div className="h-1 w-20 bg-amber-500" />
                        <h4 className="text-lg font-bold text-slate-900 uppercase tracking-widest">EBRD</h4>
                        <ul className="space-y-4 text-xl text-slate-600">
                            <li>• Real Estate Strategy 2025-2029.</li>
                            <li>• Urban Regeneration focus.</li>
                            <li>• PPP Risk-sharing.</li>
                            <li>• Social Infrastructure priority.</li>
                        </ul>
                    </div>
                </div>
            </DeckSlide>

            {/* 6. EU POLICY TAILWINDS */}
            <DeckSlide className="bg-slate-50">
                <div className="w-full">
                    <h2 className="text-6xl md:text-8xl font-bold mb-12 text-slate-900">EU Policy Tailwinds <span className="text-amber-600 text-5xl">(2025-2030)</span></h2>
                    <div className="grid md:grid-cols-2 gap-12">
                        <div className="space-y-8">
                            <div className="flex items-start gap-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                                <Landmark className="w-12 h-12 text-blue-600 shrink-0" />
                                <div>
                                    <h3 className="text-3xl font-bold text-slate-900 mb-2">European Housing Agenda</h3>
                                    <p className="text-xl text-slate-600">
                                        Commission's Housing Advisory Board directly endorsed by <strong className="text-slate-900">€375BN</strong> from promotional banks.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                                <Leaf className="w-12 h-12 text-green-600 shrink-0" />
                                <div>
                                    <h3 className="text-3xl font-bold text-slate-900 mb-2">New European Bauhaus</h3>
                                    <p className="text-xl text-slate-600">
                                        Focus on high-quality, sustainable housing. Renovation Wave and EPBD requirements mandate deep energy retrofits efficiently.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-8">
                            <div className="flex items-start gap-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                                <Euro className="w-12 h-12 text-amber-600 shrink-0" />
                                <div>
                                    <h3 className="text-3xl font-bold text-slate-900 mb-2">ECB Collateral</h3>
                                    <p className="text-xl text-slate-600">
                                        Active discussion on preferential collateral treatment for affordable housing, lowering debt costs for issuers.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                                <Scale className="w-12 h-12 text-purple-600 shrink-0" />
                                <div>
                                    <h3 className="text-3xl font-bold text-slate-900 mb-2">Lower Risk Weights</h3>
                                    <p className="text-xl text-slate-600">
                                        Prospective lower risk weights for affordable housing assets under EBA/CRR/BASEL frameworks, boosting bank appetite.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 7. PLACEHOLDER: OCTOPUS CAPITAL */}
            <DeckSlide className="bg-slate-900 border-l-[20px] border-amber-500 text-white">
                <div className="w-full max-w-6xl space-y-12">
                    <div className="inline-block bg-amber-500 text-slate-950 px-6 py-2 rounded-full font-bold uppercase tracking-widest text-sm mb-4">
                        Anchor Investor & Fund Manager
                    </div>
                    <h2 className="text-7xl md:text-9xl font-bold text-white mb-8">Octopus Capital</h2>

                    <div className="bg-slate-950/50 p-12 rounded-xl border border-dashed border-slate-700 min-h-[400px] flex flex-col items-center justify-center text-center space-y-6">
                        <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center">
                            <Anchor className="w-10 h-10 text-slate-500" />
                        </div>
                        <h3 className="text-3xl font-bold text-slate-300">Use this space for Octopus Capital History</h3>
                        <p className="text-xl text-slate-400 max-w-2xl">
                            [PLACEHOLDER: Insert mission, track record, AUM, and investment philosophy here. Reference: https://octopus-capital.com]
                        </p>
                        <div className="text-5xl font-bold text-white">€500M <span className="text-2xl font-normal text-slate-400">Committed Capital</span></div>
                    </div>
                </div>
            </DeckSlide>

            {/* 8. SPAIN: MARKET FUNDAMENTALS */}
            <DeckSlide>
                <div className="w-full grid lg:grid-cols-2 gap-20">
                    <div className="space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="px-4 py-2 bg-red-100 text-red-600 font-bold tracking-widest uppercase border border-red-200 rounded-full">Primary Target Market</div>
                            <h2 className="text-6xl md:text-8xl font-bold text-slate-900">Spain</h2>
                        </div>
                        <p className="text-3xl font-light text-slate-600 leading-snug">
                            Largest affordable housing deficit in Europe combined with strong urbanization trends (Barcelona, Madrid, Valencia, Malaga).
                        </p>
                        <p className="text-xl text-slate-600">
                            Chronic mismatch between wages and market rents creates a "price floor" for affordable products, ensuring near-zero vacancy.
                        </p>
                        <ul className="space-y-6 list-disc list-inside text-xl text-slate-600 marker:text-amber-500">
                            <li><strong className="text-slate-900">Municipal Support:</strong> Strong backing for cost-rental and limited-profit models.</li>
                            <li><strong className="text-slate-900">Institutional Exit:</strong> High demand for stabilized rental portfolios at ~5% yields.</li>
                            <li><strong className="text-slate-900">Result:</strong> An ideal blend of development IRR and stable long-term return.</li>
                        </ul>
                    </div>
                    <div className="bg-slate-50 p-10 rounded-xl space-y-12 border border-slate-200 shadow-sm">
                        <div className="space-y-2">
                            <div className="text-slate-500 uppercase tracking-widest font-bold">Development IRR</div>
                            <div className="text-7xl font-bold text-amber-600">15.0%</div>
                        </div>
                        <div className="space-y-2">
                            <div className="text-slate-500 uppercase tracking-widest font-bold">Barcelona Rent Burden</div>
                            <div className="text-7xl font-bold text-red-600">71%</div>
                        </div>
                        <div className="space-y-2">
                            <div className="text-slate-500 uppercase tracking-widest font-bold">Madrid Rent Burden</div>
                            <div className="text-7xl font-bold text-orange-500">59%</div>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 9. SPAIN: DEMAND DYNAMICS */}
            <DeckSlide>
                <div className="w-full space-y-12">
                    <h2 className="text-5xl md:text-7xl font-bold text-slate-900">Spain: Fastest Growing Demand</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white p-8 space-y-4 border-t-8 border-amber-500 shadow-md rounded-b-xl">
                            <h3 className="text-2xl font-bold text-slate-900">Demographic Explosion</h3>
                            <div className="text-5xl font-bold text-slate-900">+13.6M</div>
                            <p className="text-slate-600">Inhabitants added in 50 years. 80% concentrated in top 10 provinces. Largest absolute growth in EU (+5.9% last year).</p>
                        </div>
                        <div className="bg-white p-8 space-y-4 border-t-8 border-red-500 shadow-md rounded-b-xl">
                            <h3 className="text-2xl font-bold text-slate-900">Structural Undersupply</h3>
                            <div className="text-5xl font-bold text-red-600">-85%</div>
                            <p className="text-slate-600">Construction collapsed from 700k units/yr (2007) to just 100k today. Estimated need is 3M rental units (€550bn).</p>
                        </div>
                        <div className="bg-white p-8 space-y-4 border-t-8 border-blue-500 shadow-md rounded-b-xl">
                            <h3 className="text-2xl font-bold text-slate-900">Rental Pressure</h3>
                            <div className="text-5xl font-bold text-blue-600">26%</div>
                            <p className="text-slate-600">Rental market penetration remains low vs EU average (35%) but rising fast as homeownership requires 10-15 years savings.</p>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 10. HUNGARY: MARKET FUNDAMENTALS */}
            <DeckSlide>
                <div className="w-full grid lg:grid-cols-2 gap-20">
                    <div className="space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="px-4 py-2 bg-green-100 text-green-700 font-bold tracking-widest uppercase border border-green-200 rounded-full">High Alpha Strategy</div>
                            <h2 className="text-6xl md:text-8xl font-bold text-slate-900">Hungary</h2>
                        </div>
                        <p className="text-3xl font-light text-slate-600 leading-snug">
                            Highest MOIC contributor due to powerful development alpha and inflation-linked rents.
                        </p>
                        <ul className="space-y-6 list-disc list-inside text-xl text-slate-600 marker:text-green-600">
                            <li><strong className="text-slate-900">Younger Demographics:</strong> Younger profile than Western Europe plus significant inward migration (Ukraine).</li>
                            <li><strong className="text-slate-900">Inflation Hedge:</strong> Strong rent indexation in high-inflation environment.</li>
                            <li><strong className="text-slate-900">Supply Collapse:</strong> Only 13,300 new units in 2024 (-30% YoY), leading to acute shortage.</li>
                        </ul>
                    </div>
                    <div className="bg-slate-50 p-10 rounded-xl space-y-12 border border-slate-200 shadow-sm">
                        <div className="space-y-2">
                            <div className="text-slate-500 uppercase tracking-widest font-bold">Unlevered Dev IRR</div>
                            <div className="text-7xl font-bold text-green-600">20-24%</div>
                        </div>
                        <div className="space-y-2">
                            <div className="text-slate-500 uppercase tracking-widest font-bold">Price Growth Since 2015</div>
                            <div className="text-7xl font-bold text-slate-900">+237%</div>
                        </div>
                        <div className="space-y-2">
                            <div className="text-slate-500 uppercase tracking-widest font-bold">Exit Yield</div>
                            <div className="text-7xl font-bold text-slate-500">5.75%</div>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 11. ITALY, PORTUGAL, POLAND */}
            <DeckSlide>
                <div className="w-full space-y-12">
                    <h2 className="text-6xl font-bold mb-12 text-slate-900">Key Growth Markets</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg hover:shadow-xl transition-shadow group">
                            <h3 className="text-4xl font-bold text-slate-900 mb-4 group-hover:text-amber-600 transition-colors">Italy</h3>
                            <div className="text-amber-600 font-bold text-xl mb-6 uppercase tracking-wider">Inflation Anchor</div>
                            <ul className="space-y-3 text-slate-600 text-lg">
                                <li>• Oldest rental stock in EU.</li>
                                <li>• Municipal social PPPs adopting.</li>
                                <li>• Yields: 5.25 - 5.5%.</li>
                                <li>• <span className="font-bold">Portfolio Role:</span> Stable Income.</li>
                            </ul>
                        </div>
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg hover:shadow-xl transition-shadow group">
                            <h3 className="text-4xl font-bold text-slate-900 mb-4 group-hover:text-amber-600 transition-colors">Portugal</h3>
                            <div className="text-blue-600 font-bold text-xl mb-6 uppercase tracking-wider">High Yield, Low Vol</div>
                            <ul className="space-y-3 text-slate-600 text-lg">
                                <li>• Shortages in Lisbon/Porto.</li>
                                <li>• Digital Nomad / Tech inflows.</li>
                                <li>• Yields: ~5.25%.</li>
                                <li>• <span className="font-bold">Portfolio Role:</span> Income Contributor.</li>
                            </ul>
                        </div>
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg hover:shadow-xl transition-shadow group">
                            <h3 className="text-4xl font-bold text-slate-900 mb-4 group-hover:text-amber-600 transition-colors">Poland</h3>
                            <div className="text-red-600 font-bold text-xl mb-6 uppercase tracking-wider">Growth Engine</div>
                            <ul className="space-y-3 text-slate-600 text-lg">
                                <li>• Strong wage growth.</li>
                                <li>• Deficits in Warsaw/Kraków.</li>
                                <li>• IRR: 18-22% (High).</li>
                                <li>• <span className="font-bold">Portfolio Role:</span> Resilience.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 12. PLACEHOLDER: FUNDAMENTAL ANALYSIS TABLE */}
            <DeckSlide className="bg-slate-50">
                <div className="w-full space-y-12">
                    <div className="flex flex-col gap-4">
                        <div className="inline-block px-4 py-1 bg-slate-200 text-slate-600 text-sm font-bold uppercase tracking-widest w-fit rounded-full">Data Integration</div>
                        <h2 className="text-5xl md:text-7xl font-bold text-slate-900">Fundamental Analysis</h2>
                        <p className="text-xl text-slate-600">
                            Rent Burden & Affordability Stress Maps across key target markets driven by our proprietary data.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                        <div className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-2xl font-bold text-slate-900 border-b-2 border-amber-500 pb-2 inline-block">Spain</h3>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between text-slate-500 text-sm font-medium"><span>Barcelona</span><span className="text-red-600 font-bold">71%</span></div>
                                    <div className="w-full bg-slate-100 h-2 mt-1 rounded-full"><div className="bg-red-600 h-2 w-[71%] rounded-full"></div></div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-slate-500 text-sm font-medium"><span>Madrid</span><span className="text-orange-500 font-bold">59%</span></div>
                                    <div className="w-full bg-slate-100 h-2 mt-1 rounded-full"><div className="bg-orange-500 h-2 w-[59%] rounded-full"></div></div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-2xl font-bold text-slate-900 border-b-2 border-blue-500 pb-2 inline-block">Netherlands</h3>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between text-slate-500 text-sm font-medium"><span>Amsterdam</span><span className="text-red-600 font-bold">90%</span></div>
                                    <div className="w-full bg-slate-100 h-2 mt-1 rounded-full"><div className="bg-red-600 h-2 w-[90%] rounded-full"></div></div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-slate-500 text-sm font-medium"><span>Rotterdam</span><span className="text-red-500 font-bold">72%</span></div>
                                    <div className="w-full bg-slate-100 h-2 mt-1 rounded-full"><div className="bg-red-500 h-2 w-[72%] rounded-full"></div></div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-2xl font-bold text-slate-900 border-b-2 border-purple-500 pb-2 inline-block">France</h3>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between text-slate-500 text-sm font-medium"><span>Paris</span><span className="text-red-600 font-bold">90%</span></div>
                                    <div className="w-full bg-slate-100 h-2 mt-1 rounded-full"><div className="bg-red-600 h-2 w-[90%] rounded-full"></div></div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-slate-500 text-sm font-medium"><span>Lyon</span><span className="text-orange-500 font-bold">65%</span></div>
                                    <div className="w-full bg-slate-100 h-2 mt-1 rounded-full"><div className="bg-orange-500 h-2 w-[65%] rounded-full"></div></div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-2xl font-bold text-slate-900 border-b-2 border-green-500 pb-2 inline-block">CEE</h3>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between text-slate-500 text-sm font-medium"><span>Prague</span><span className="text-green-600 font-bold">45%</span></div>
                                    <div className="w-full bg-slate-100 h-2 mt-1 rounded-full"><div className="bg-green-600 h-2 w-[45%] rounded-full"></div></div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-slate-500 text-sm font-medium"><span>Warsaw</span><span className="text-green-600 font-bold">45%</span></div>
                                    <div className="w-full bg-slate-100 h-2 mt-1 rounded-full"><div className="bg-green-600 h-2 w-[45%] rounded-full"></div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 13. ESG & RISK */}
            <DeckSlide>
                <div className="w-full grid lg:grid-cols-2 gap-20">
                    <div className="space-y-8">
                        <h2 className="text-5xl md:text-7xl font-bold text-slate-900">ESG as an Asset Class</h2>
                        <ul className="text-2xl text-slate-700 space-y-6">
                            <li className="flex items-center gap-4"><ShieldCheck className="text-green-600 w-8 h-8" /> EU Taxonomy (Social Objectives)</li>
                            <li className="flex items-center gap-4"><ShieldCheck className="text-green-600 w-8 h-8" /> CSRD (Mandatory Reporting)</li>
                            <li className="flex items-center gap-4"><ShieldCheck className="text-green-600 w-8 h-8" /> SFDR (Article 8/9 Classification)</li>
                        </ul>
                        <p className="text-slate-600 text-lg border-l-4 border-green-500 pl-4 py-2 bg-green-50 rounded-r">
                            LPs benefit from clear compliance, credibility, and lower funding costs through ESG-aligned capital pools.
                        </p>
                    </div>
                    <div className="bg-slate-50 p-10 rounded-xl border border-slate-200 shadow-md">
                        <h3 className="text-3xl font-bold text-slate-900 mb-6">Reputational Risk Mgmt</h3>
                        <p className="text-lg text-slate-600 mb-6">Institutional investors face rising media scrutiny regarding rent increases and evictions.</p>
                        <ul className="space-y-4 text-slate-600">
                            <li>• <strong className="text-slate-900">Solution:</strong> The Legacy Fund Structure.</li>
                            <li>• Permanent affordability constraints (No-Flipping).</li>
                            <li>• Professional property management (No slums).</li>
                            <li>• Involvement of Europe's promotional banks as guarantors of social intent.</li>
                        </ul>
                    </div>
                </div>
            </DeckSlide>

            {/* 14. TAILWINDS: REGULATORY + MACRO */}
            <DeckSlide>
                <div className="w-full space-y-16">
                    <h2 className="text-6xl md:text-8xl font-bold text-center text-slate-900">Three Pillars of Value</h2>
                    <div className="grid md:grid-cols-3 gap-px bg-slate-200 border border-slate-200 shadow-xl rounded-2xl overflow-hidden">
                        <div className="bg-white p-12 space-y-6 hover:bg-slate-50 transition-colors group">
                            <h3 className="text-3xl font-bold text-amber-600">1. Collateral</h3>
                            <p className="text-4xl text-slate-900 font-light group-hover:scale-105 transition-transform origin-left">ECB Eligibility</p>
                            <p className="text-lg text-slate-600">Potential preferential status leads to yield compression and higher NAV (6-12% uplift potential).</p>
                        </div>
                        <div className="bg-white p-12 space-y-6 hover:bg-slate-50 transition-colors group">
                            <h3 className="text-3xl font-bold text-blue-600">2. Capital</h3>
                            <p className="text-4xl text-slate-900 font-light group-hover:scale-105 transition-transform origin-left">Zero Risk Weight</p>
                            <p className="text-lg text-slate-600">Lower RWAs means cheaper bank financing, higher lending volumes, and higher Equity IRRs.</p>
                        </div>
                        <div className="bg-white p-12 space-y-6 hover:bg-slate-50 transition-colors group">
                            <h3 className="text-3xl font-bold text-purple-600">3. Macro</h3>
                            <p className="text-4xl text-slate-900 font-light group-hover:scale-105 transition-transform origin-left">Inflation Hedge</p>
                            <p className="text-lg text-slate-600">In an AI-era of monetary expansion, rents index with inflation while nominal debt shrinks in real terms.</p>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 15. WHY NOW? */}
            <DeckSlide>
                <div className="w-full flex items-center gap-20">
                    <div className="hidden lg:block w-1/3">
                        <ClockWidget />
                    </div>
                    <div className="w-full lg:w-2/3 space-y-10">
                        <h2 className="text-6xl md:text-8xl font-bold text-slate-900">Why Now? <br /> <span className="text-amber-600 text-5xl">2025-2030 Window</span></h2>
                        <ul className="space-y-6 text-2xl text-slate-600">
                            <li>• <strong className="text-red-500">+60.5%</strong> housing price increase since 2015 has peaked affordability stress.</li>
                            <li>• <strong className="text-red-500">Supply Collapse:</strong> Construction contracting everywhere creates first-mover advantage.</li>
                            <li>• <strong className="text-blue-500">EIB Mandate:</strong> 1M dwellings/year needed is now a political imperative.</li>
                            <li>• <strong className="text-green-500">Public Capital:</strong> Unprecedented alignment of EIB, EIF, and EBRD capital pools.</li>
                        </ul>
                    </div>
                </div>
            </DeckSlide>

            {/* 16. GOVERNANCE ARCHITECTURE */}
            <DeckSlide>
                <div className="w-full space-y-16">
                    <h2 className="text-5xl md:text-7xl font-bold text-center text-slate-900">Governance Architecture</h2>
                    <div className="grid md:grid-cols-3 gap-8 text-center">
                        <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-lg hover:translate-y-[-5px] transition-transform">
                            <Users className="w-16 h-16 text-amber-600 mx-auto mb-6" />
                            <h3 className="text-3xl font-bold text-slate-900 mb-4">Board of Directors</h3>
                            <p className="text-slate-600">
                                5 Members + Chair. Approves investment policy, risk, and ESG strategy. Oversees compliance with affordability commitments (No-Net-Loss).
                            </p>
                        </div>
                        <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-lg hover:translate-y-[-5px] transition-transform">
                            <Globe2 className="w-16 h-16 text-blue-600 mx-auto mb-6" />
                            <h3 className="text-3xl font-bold text-slate-900 mb-4">Advisory Board</h3>
                            <p className="text-slate-600">
                                5 Pro-bono experts in housing policy and finance. Provides strategic advice on innovation and alignment with public sector goals.
                            </p>
                        </div>
                        <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-lg hover:translate-y-[-5px] transition-transform">
                            <ShieldCheck className="w-16 h-16 text-green-600 mx-auto mb-6" />
                            <h3 className="text-3xl font-bold text-slate-900 mb-4">Audit & Impact</h3>
                            <p className="text-slate-600">
                                External Annual Financial Audit & Independent Impact Verification to ensure SFDR compliance.
                            </p>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 17. PARTNERSHIP MODELS (Economics) */}
            <DeckSlide>
                <div className="w-full">
                    <h2 className="text-5xl md:text-7xl font-bold mb-12 text-slate-900">Partnership Economics <span className="text-2xl text-slate-500 align-middle">(Per €1bn Capital)</span></h2>
                    <div className="grid md:grid-cols-2 gap-12">
                        {/* CASE A */}
                        <div className="bg-white p-8 rounded-xl border-t-8 border-blue-600 shadow-lg">
                            <h3 className="text-3xl font-bold text-slate-900 mb-6">Case A: IM Brings Capital</h3>
                            <div className="space-y-4 text-slate-600">
                                <div className="flex justify-between border-b border-slate-100 pb-2"><span>IM Mgmt Fee</span><span>1.0%</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-2"><span>Fund Share (Mgmt)</span><span className="text-green-600 font-bold">30% (€3m/yr)</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-2"><span>Fund Share (Commitment)</span><span className="text-green-600 font-bold">30% (€1.5m)</span></div>
                                <div className="p-4 bg-blue-50 mt-4 rounded text-center border border-blue-100">
                                    <div className="text-xl text-slate-500">Result for Fund (5yrs)</div>
                                    <div className="text-4xl font-bold text-blue-900">€18.25m <span className="text-sm">Income</span></div>
                                    <div className="text-xs text-slate-500">No cost to Fund.</div>
                                </div>
                            </div>
                        </div>
                        {/* CASE B */}
                        <div className="bg-white p-8 rounded-xl border-t-8 border-purple-600 shadow-lg">
                            <h3 className="text-3xl font-bold text-slate-900 mb-6">Case B: Fund Raises Capital</h3>
                            <div className="space-y-4 text-slate-600">
                                <div className="flex justify-between border-b border-slate-100 pb-2"><span>Mgmt Fee Charged</span><span>1.0% (€50m/5yr)</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-2"><span>Sub-Advisory Paid</span><span className="text-red-500 font-bold">0.40% (€20m)</span></div>
                                <div className="flex justify-between border-b border-slate-100 pb-2"><span>Carry Retained</span><span className="text-green-600 font-bold">75%</span></div>
                                <div className="p-4 bg-purple-50 mt-4 rounded text-center border border-purple-100">
                                    <div className="text-xl text-slate-500">Result for Fund (5yrs)</div>
                                    <div className="text-4xl font-bold text-purple-900">€19m <span className="text-sm">Profit</span></div>
                                    <div className="text-xs text-slate-500">After OPEX and Sub-advisory costs.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 18. SIMULATOR LOGIC */}
            <DeckSlide className="bg-indigo-50 border-t border-b border-indigo-100">
                <div className="grid lg:grid-cols-2 gap-20 items-center w-full">
                    <div className="space-y-8">
                        <h2 className="text-5xl md:text-7xl font-bold text-slate-900">Transparency Core</h2>
                        <p className="text-2xl text-slate-600 font-light">
                            The Fund Simulator engine powers our underwriting. Every assumption, from cost of debt to exit caps, is visible and auditable.
                        </p>
                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-lg flex justify-between items-center shadow-sm">
                                <span className="text-slate-600">Total Capital</span>
                                <span className="font-bold text-slate-900">€1.4 Billion</span>
                            </div>
                            <div className="bg-white p-4 rounded-lg flex justify-between items-center shadow-sm">
                                <span className="text-slate-600">Base Leverage</span>
                                <span className="font-bold text-slate-900">50% @ 2.0% Fixed</span>
                            </div>
                            <div className="bg-white p-4 rounded-lg flex justify-between items-center shadow-sm">
                                <span className="text-slate-600">Avg Dev IRR</span>
                                <span className="font-bold text-slate-900">14.95%</span>
                            </div>
                            <div className="bg-white p-4 rounded-lg flex justify-between items-center shadow-sm">
                                <span className="text-slate-600">Net Profit (Hold)</span>
                                <span className="font-bold text-slate-900">{'>'}€2 Billion</span>
                            </div>
                        </div>
                        <Link href="/simulators/affordable-housing-fund" target="_blank">
                            <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white font-bold w-full py-8 text-xl rounded-xl mt-6">
                                Launch Live Simulator
                            </Button>
                        </Link>
                    </div>
                    <div className="hidden lg:block bg-slate-900 p-8 rounded-2xl border border-white/10 opacity-90 rotate-3 scale-90 shadow-2xl">
                        {/* Visual representation of waterfall */}
                        <div className="space-y-2 font-mono text-xs text-green-400">
                            <div>def calculate_waterfall(cashflows):</div>
                            <div className="pl-4">hurdle = 0.08</div>
                            <div className="pl-4">promote = 0.20</div>
                            <div className="pl-4">return apply_distribution(cashflows, hurdle, promote)</div>
                            <div className="mt-4 text-slate-500"># Real-time Python Calculation</div>
                            <div className="mt-2 text-blue-400"># Verifiable Inputs</div>
                        </div>
                    </div>
                </div>
            </DeckSlide>

            {/* 19. PIPELINE PLACEHOLDER */}
            <DeckSlide className="bg-slate-900 border-r-[20px] border-green-500 text-white">
                <div className="w-full max-w-6xl space-y-12 text-right">
                    <div className="inline-block bg-green-500 text-slate-950 px-6 py-2 rounded-full font-bold uppercase tracking-widest text-sm mb-4">
                        Deal Flow
                    </div>
                    <h2 className="text-7xl md:text-9xl font-bold text-white mb-8">Investment Pipeline</h2>

                    <div className="bg-slate-950/50 p-12 rounded-xl border border-dashed border-slate-700 min-h-[400px] flex flex-col items-center justify-center text-center space-y-6">
                        <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center">
                            <Search className="w-10 h-10 text-slate-500" />
                        </div>
                        <h3 className="text-3xl font-bold text-slate-300">Use this space for Real-time Deal Pipeline</h3>
                        <p className="text-xl text-slate-400 max-w-2xl">
                            [PLACEHOLDER: Insert information on the Fund’s investment opportunities pipeline here. List specific assets or cities under review, including status (LOI, DD, Closed).]
                        </p>
                    </div>
                </div>
            </DeckSlide>

            {/* 20. LEADERSHIP & SPONSOR */}
            <DeckSlide>
                <div className="flex flex-col md:flex-row gap-20 items-center w-full">
                    <div className="shrink-0">
                        <div className="w-80 h-80 bg-slate-100 rounded-full border-8 border-amber-500 flex items-center justify-center overflow-hidden transition-all duration-500 group cursor-pointer shadow-xl">
                            <Users className="w-32 h-32 text-slate-400" />
                        </div>
                    </div>
                    <div className="space-y-8">
                        <h2 className="text-6xl md:text-8xl font-bold text-slate-900">Dr. Jaime Luque</h2>
                        <p className="text-amber-600 text-3xl font-medium">Fund Sponsor</p>
                        <ul className="space-y-4 text-xl text-slate-700">
                            <li>• European Commission Housing Advisory Board Member.</li>
                            <li>• Director, Real Estate Innovation Program (Govt of Monaco).</li>
                            <li>• Board Advisor & Head of Europe, Upper Echelon.</li>
                            <li>• Director, ESCP Institute of Real Estate Finance.</li>
                        </ul>
                        <p className="text-slate-500 text-lg italic border-l-4 border-slate-300 pl-4">
                            "Advising European public authorities, national governments, and national promotional banks on long-term housing finance mechanisms."
                        </p>
                    </div>
                </div>
            </DeckSlide>

            {/* 21. DISCLAIMERS */}
            <DeckSlide className="bg-slate-100 text-slate-600">
                <div className="w-full max-w-5xl space-y-8">
                    <h2 className="text-4xl font-bold text-slate-800">Disclaimers</h2>
                    <div className="grid md:grid-cols-2 gap-8 text-xs text-slate-500 leading-relaxed text-justify">
                        <p>
                            <strong>Forward-Looking Statements:</strong> This presentation may contain forward-looking statements and projections. These statements involve risks and uncertainties and are subject to change. Actual results may differ materially. The Sponsor undertakes no obligation to update or revise any forward-looking information.
                        </p>
                        <p>
                            <strong>Accuracy and No-Reliance:</strong> Information contained herein is believed to be reliable but no representation or warranty, express or implied, is made as to its accuracy or completeness. Recipients may not rely on this presentation for any investment decision.
                        </p>
                        <p>
                            <strong>Past Performance:</strong> Past performance is not indicative or a guarantee of future results. No representation is made that any returns will be achieved or that investment objectives will be met.
                        </p>
                        <p>
                            <strong>Confidential:</strong> Not for Distribution. Pre-Marketing Material.
                        </p>
                    </div>
                    <div className="pt-20 text-center text-slate-400 uppercase tracking-widest font-bold text-sm">
                        © 2026 Pan-European Affordable Housing Fund
                    </div>
                </div>
            </DeckSlide>

        </main>
    );
}

function ClockWidget() {
    return (
        <div className="relative w-64 h-64 rounded-full border-8 border-slate-200 flex items-center justify-center bg-white shadow-lg">
            <div className="absolute inset-0 rounded-full border-t-8 border-amber-500 animate-[spin_10s_linear_infinite]" />
            <div className="text-center">
                <div className="text-4xl font-bold text-slate-900">NOW</div>
                <div className="text-sm text-slate-400">2025-2030</div>
            </div>
        </div>
    )
}
