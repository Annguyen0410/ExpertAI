from agents.base import BaseAgent

FINANCIAL_PROMPT = """You are an ExpertAI Financial Agent, an AI financial advisor assistant. You help users with:
- Budgeting and personal finance planning
- Tax strategy and preparation guidance
- Investment basics and retirement planning
- Debt management strategies
- Financial document review

Rules:
1. You are NOT a certified financial planner or CPA and MUST disclaim this
2. Do not give specific stock picks or trading advice
3. Provide educational information about financial concepts
4. For complex tax situations, recommend consulting a CPA
5. Flag any queries involving >$50k transactions, fraud allegations, or estate planning for escalation
6. Use clear, actionable language with specific numbers where helpful"""

FINANCIAL_FALLBACKS = {
    "budget": """**DISCLAIMER: I am an AI assistant, not a financial advisor. This is for educational purposes only.**

## Budgeting Framework: The 50/30/20 Rule

A recommended starting point for personal budgeting:

- **50% — Needs**: Housing, utilities, groceries, transportation, minimum debt payments, insurance.
- **30% — Wants**: Dining out, entertainment, shopping, travel, hobbies.
- **20% — Savings & Debt**: Emergency fund, retirement contributions, extra debt payments, investments.

### Practical Steps:
1. **Track spending** for 30 days using an app or spreadsheet
2. **Categorize** every expense into Needs/Wants/Savings
3. **Identify leaks**: Small daily expenses (coffee, subscriptions) add up fast
4. **Automate savings**: Set up automatic transfers on payday
5. **Build emergency fund**: Aim for 3-6 months of essential expenses

### Common Budgeting Methods:
- **Zero-Based Budget**: Every dollar is assigned a purpose
- **Envelope System**: Cash for discretionary categories
- **Pay-Yourself-First**: Savings before expenses""",
    "tax": """**DISCLAIMER: I am an AI assistant, not a CPA. Consult a licensed tax professional for your specific situation.**

## Tax Planning Basics

### For W-2 Employees:
- Maximize retirement contributions (401k: $23,000 in 2024, +$7,500 if 50+)
- HSA contributions ($4,150 individual / $8,300 family) are triple tax-advantaged
- Withhold correctly using the IRS W-4 calculator

### For Self-Employed/1099:
- Track all business expenses (home office, equipment, software, travel)
- Consider Solo 401k or SEP IRA (up to 25% of net income)
- Pay quarterly estimated taxes to avoid penalties
- Deduct health insurance premiums

### Common Deductions & Credits:
1. **Standard Deduction** (2024): $14,600 single / $29,200 married filing jointly
2. **Child Tax Credit**: Up to $2,000 per qualifying child
3. **Earned Income Tax Credit**: For low-to-moderate income workers
4. **Education Credits**: American Opportunity ($2,500) and Lifetime Learning ($2,000)
5. **SALT Deduction**: State and local taxes capped at $10,000""",
    "invest": """**DISCLAIMER: I am an AI assistant, not a financial advisor. This is not investment advice.**

## Investment Basics

### Asset Classes:
- **Stocks (Equities)**: Higher risk/reward. Long-term avg return ~10%/yr
- **Bonds (Fixed Income)**: Lower risk/reward. Provides stability and income
- **Cash/Money Market**: Safe but loses to inflation
- **Real Estate**: Can provide income and appreciation
- **Commodities**: Gold, oil, etc. Inflation hedge

### Simple Portfolio Strategy:
1. **Emergency fund first** (3-6 months expenses in high-yield savings)
2. **Pay high-interest debt** (>7% APR)
3. **Invest in broad market index funds** (S&P 500, Total Market)
4. **Dollar-cost average**: Invest regularly regardless of market conditions
5. **Rebalance annually**: Sell winners, buy laggards to maintain target allocation

### Age-Based Allocation (Rule of Thumb):
- **20s-30s**: 80-90% stocks / 10-20% bonds
- **40s-50s**: 60-70% stocks / 30-40% bonds
- **60+**: 40-50% stocks / 50-60% bonds

### Key Accounts:
- **Taxable**: Flexible, no contribution limits
- **401k/IRA**: Tax-advantaged retirement savings
- **Roth IRA**: Tax-free growth, post-tax contributions""",
    "debt": """**DISCLAIMER: I am an AI assistant, not a financial advisor. This is for educational purposes.**

## Debt Management Strategies

### The Avalanche Method (Mathematically Optimal):
- List all debts by interest rate (highest first)
- Pay minimums on everything
- Put extra money toward the highest-interest debt
- When paid off, roll that payment to the next highest

### The Snowball Method (Behavioral):
- List debts by balance (smallest first)
- Pay minimums on everything
- Put extra toward the smallest balance
- Builds momentum through quick wins

### Which to Choose?
- **Avalanche** saves the most money on interest
- **Snowball** is better if you need motivation from quick progress

### Red Flags (Consider Credit Counseling):
- Minimum payments exceed 20% of take-home pay
- Using credit cards for everyday necessities
- Late fees or collection calls
- Considering debt consolidation without understanding fees""",
}

class FinancialAgent(BaseAgent):
    def __init__(self):
        super().__init__(FINANCIAL_PROMPT, FINANCIAL_FALLBACKS)

    def advise(self, query: str, context: list | None = None) -> str:
        return self.run(query, context)
