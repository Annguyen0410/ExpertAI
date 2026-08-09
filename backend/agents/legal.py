from agents.base import BaseAgent

LEGAL_PROMPT = """You are an ExpertAI Legal Agent, an AI legal assistant. You help users with:
- Drafting and reviewing contracts (leases, NDAs, service agreements)
- Understanding legal rights and obligations
- Explaining legal concepts in plain language
- Document templates and form guidance

Rules:
1. You are NOT a lawyer and MUST disclaim this at the start of each response
2. You cannot represent users in court or give binding legal opinions
3. You MUST recommend consulting a licensed attorney for complex matters
4. Use clear, plain language
5. Cite general legal principles, not specific case law
6. For document review, identify key clauses, risks, and suggested changes
7. If the user mentions active litigation, criminal charges, or court deadlines, flag for escalation"""

LEGAL_FALLBACKS = {
    "lease": """**IMPORTANT DISCLAIMER: I am an AI assistant, not a lawyer. The following is for informational purposes only and does not constitute legal advice.**

## Key Clauses to Review in a Residential Lease Agreement

1. **Rent & Fees**: Confirm the monthly rent, due date, late fees, and acceptable payment methods. Look for hidden fees (parking, maintenance, amenities).

2. **Security Deposit**: Check the amount (typically 1-2 months' rent), what it covers, and the timeline for return after move-out. Many states require it to be held in a separate interest-bearing account.

3. **Lease Term & Renewal**: Note the start/end dates, whether it automatically renews (month-to-month), and the notice period required to terminate.

4. **Maintenance & Repairs**: Understand who is responsible for what. Landlord should handle major systems (HVAC, plumbing, electrical). Tenant typically handles minor upkeep.

5. **Utilities**: Clarify which utilities are included in rent (water, trash, gas) and which are tenant responsibility (electricity, internet, cable).

6. **Pets & Guests**: Check pet policies, deposits, breed restrictions, and guest stay limits.

7. **Early Termination**: Understand penalties for breaking the lease early. Some leases include a "buyout" clause (1-2 months' rent) vs owing the remaining balance.

8. **Subleasing**: If you might need to sublet, confirm the landlord's approval process and any restrictions.

9. **Entry Notice**: Landlord typically must provide 24-48 hours notice before entering. Check your state's specific requirements.

10. **Dispute Resolution**: Some leases require binding arbitration instead of court. Review carefully.

**Recommended Next Steps**: Read the entire document carefully. Make note of any handwritten modifications (both parties should initial these). Consider having a local tenant's rights organization or attorney review if anything seems unusual.""",
    "nda": """**IMPORTANT DISCLAIMER: I am an AI assistant, not a lawyer. The following is for informational purposes only.**

## Key Clauses in an NDA (Non-Disclosure Agreement)

1. **Definition of Confidential Information**: Ensure it's clearly defined and not overly broad. Look for exclusions (public info, independently developed, received from third party).

2. **Obligations of Receiving Party**: Standard obligations include using confidential info only for the permitted purpose and protecting it with reasonable care.

3. **Term**: How long does the confidentiality obligation last? Typical is 2-5 years, but trade secrets should be perpetual.

4. **Permitted Disclosures**: Usually allows disclosure to employees/contractors with a need-to-know, and when required by law.

5. **Return of Materials**: Upon termination, confidential materials must be returned or destroyed.

6. **Non-Solicitation**: Some NDAs include clauses preventing you from hiring the other party's employees.

7. **Jurisdiction**: Which state's law governs the agreement.

**Red Flags**: Perpetual term for non-trade-secret info, no exclusions for publicly available info, requirement to return "all" materials including your own notes.""",
    "contract": """**IMPORTANT DISCLAIMER: I am an AI assistant, not a lawyer. The following is for informational purposes only.**

## Contract Review Checklist

1. **Parties**: Verify all party names and addresses are correct.
2. **Effective Date**: When does the agreement begin?
3. **Scope of Work/Services**: Is the description clear and complete?
4. **Payment Terms**: Amount, schedule, late fees, invoicing process.
5. **Term & Termination**: Duration, notice periods, termination for cause/convenience.
6. **Warranties**: What is each party guaranteeing?
7. **Indemnification**: Who is responsible for what losses?
8. **Limitation of Liability**: Typically caps damages to fees paid.
9. **Confidentiality**: What information must be kept private?
10. **Dispute Resolution**: Court vs arbitration, governing law.

**Always look for**: Unilateral amendment rights, automatic renewal clauses, and assignment restrictions that require consent.""",
}

class LegalAgent(BaseAgent):
    def __init__(self):
        super().__init__(LEGAL_PROMPT, LEGAL_FALLBACKS)

    def advise(self, query: str, context: list | None = None) -> str:
        return self.run(query, context)
