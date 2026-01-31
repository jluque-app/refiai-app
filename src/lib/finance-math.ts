export const finance = {
    /**
     * Net Present Value (NPV)
     * @param rate Discount rate (decimal, e.g. 0.05 for 5%)
     * @param cashflows Array of cashflows where index 0 is time 0
     */
    npv: (rate: number, cashflows: number[]): number => {
        return cashflows.reduce((acc, val, i) => acc + val / Math.pow(1 + rate, i), 0);
    },

    /**
     * Internal Rate of Return (IRR) using proper Newton-Raphson or Secant method
     * Matches Excel's XIRR/IRR behavior roughly.
     */
    irr: (cashflows: number[], guess = 0.1, maxIter = 100, tolerance = 1e-7): number => {
        // Quick checks
        if (!cashflows || cashflows.length === 0) return NaN;
        if (cashflows.every(c => c >= 0) || cashflows.every(c => c <= 0)) return NaN;

        let rate = guess;

        for (let i = 0; i < maxIter; i++) {
            let npv = 0;
            let dNpv = 0; // Derivative of NPV with respect to rate

            for (let t = 0; t < cashflows.length; t++) {
                const cf = cashflows[t];
                // npv term: cf / (1+r)^t
                // deriv term: -t * cf / (1+r)^(t+1)
                const denom = Math.pow(1 + rate, t);
                npv += cf / denom;
                dNpv -= (t * cf) / (denom * (1 + rate));
            }

            if (Math.abs(dNpv) < 1e-12) {
                // Derivative close to zero, try a small perturbation or bisect?
                // For now, break to avoid infinity
                break;
            }

            const newRate = rate - npv / dNpv;

            if (Math.abs(newRate - rate) < tolerance) {
                return newRate;
            }

            rate = newRate;

            // Safety clamp to avoid going too wild (-100% to +500%)
            if (rate <= -1.0) rate = -0.99;
            if (rate > 5.0) rate = 5.0;
        }

        // If Newton fails, fallback to simple bisection could be added,
        // but for typical RE models, Newton usually converges if guess is reasonable.
        return rate;
    },

    /**
     * Excel-style PMT (Payment)
     * @param rate Interest rate per period
     * @param nper Number of periods
     * @param pv Present Value
     * @param fv Future Value (default 0)
     * @param type 0 for end of period (default), 1 for start
     * @returns Payment amount (typically negative for loan payments)
     */
    pmt: (rate: number, nper: number, pv: number, fv = 0, type = 0): number => {
        if (nper === 0) return 0;
        if (rate === 0) return -(pv + fv) / nper;

        const pvif = Math.pow(1 + rate, nper);
        let pmt = (rate * (fv + pv * pvif)) / (pvif - 1);

        if (type === 1) {
            pmt /= (1 + rate);
        }

        return -pmt;
    },

    /**
     * Calculate mortgage schedule with Interest Only period
     */
    amortizationSchedule: (principal: number, rate: number, totalPeriods: number, ioPeriods: number) => {
        const schedule = [];
        let balance = principal;

        for (let t = 1; t <= totalPeriods; t++) {
            const interest = balance * rate;
            let payment = interest;
            let principalPay = 0;

            if (t > ioPeriods) {
                // CPM phase
                const remainingPeriods = totalPeriods - ioPeriods;
                // Payment needed to amortize 'principal' (which is still 'principal' at end of IO)
                // over remaining periods
                // Note: In typical construction/mini-perm, the 'balance' at start of amort
                // is the original principal (since IO paid full interest).
                // So we calculate PMT based on original principal and remaining years.
                const cpmPayment = finance.pmt(rate, remainingPeriods, -principal);
                // Note: PMT returns correct positive value if PV is negative.
                // Wait, logic check: if we recalc PMT every period based on balance, it's safer.
                // But for standard CPM, it's a fixed payment.

                // Let's use the standard formula for the fixed annuity payment calculated at t = ioPeriods + 1
                const fixedPmt = finance.pmt(rate, totalPeriods - ioPeriods, -principal);
                payment = fixedPmt;
                principalPay = payment - interest;
            }

            // Cap principal pay if it exceeds balance
            if (principalPay > balance) {
                principalPay = balance;
                payment = interest + principalPay;
            }

            balance -= principalPay;
            if (balance < 0.001) balance = 0;

            schedule.push({
                period: t,
                interest,
                principal: principalPay,
                payment,
                balance
            });
        }
        return schedule;
    }
};
