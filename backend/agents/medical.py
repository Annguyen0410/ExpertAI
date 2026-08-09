from agents.base import BaseAgent

MEDICAL_PROMPT = """You are an ExpertAI Medical Agent, an AI medical information assistant. You help users with:
- Understanding medical terminology and diagnoses
- Explaining treatment options and procedures
- Medication information and side effects
- Health and wellness guidance
- Preparing for doctor visits

Rules:
1. You are NOT a doctor and MUST disclaim this prominently
2. You CANNOT diagnose conditions or prescribe medication
3. For emergency symptoms (chest pain, difficulty breathing, severe bleeding), IMMEDIATELY recommend calling 911
4. Provide general health information only
5. Flag any query requesting a diagnosis, prescription, or describing emergency symptoms for escalation
6. Encourage users to consult with their healthcare provider
7. This is for informational purposes only"""

MEDICAL_FALLBACKS = {
    "symptom": """**⚠️ IMPORTANT: I am an AI assistant, NOT a doctor. If you are experiencing a medical emergency (chest pain, difficulty breathing, severe bleeding, sudden numbness), call 911 immediately.**

## Understanding Your Symptoms

While I cannot provide a diagnosis, here are general steps to discuss with your healthcare provider:

1. **Document your symptoms**: When did they start? How severe? What makes them better/worse?
2. **Track patterns**: Keep a symptom diary noting time, intensity, and triggers
3. **Review your history**: Note any recent illnesses, injuries, or lifestyle changes
4. **Gather family history**: Some conditions have genetic components

### When to See a Doctor:
- Symptoms lasting more than 2 weeks
- Unexplained weight loss or fever
- Persistent pain affecting daily activities
- New or changing moles/skin growths
- Changes in bowel or bladder habits

### Prepare for Your Visit:
- Write down your questions beforehand
- Bring a list of all medications and supplements
- Bring relevant medical records
- Ask about next steps and follow-up schedule

**Remember**: This information is for educational purposes. Always consult a licensed healthcare provider for medical advice specific to your situation.""",
    "medication": """**⚠️ IMPORTANT: I am an AI assistant, NOT a doctor or pharmacist. Never change your medication regimen without consulting your healthcare provider.**

## Medication Information (Educational)

### Questions to Ask Your Doctor/Pharmacist:
1. What is this medication for and how does it work?
2. What is the correct dosage and timing?
3. Should I take it with food or on an empty stomach?
4. What are common side effects and when do they subside?
5. What medications, supplements, or foods should I avoid?
6. What should I do if I miss a dose?
7. Are there any warning signs that require immediate medical attention?

### Medication Safety Tips:
- Use one pharmacy for all prescriptions to avoid drug interactions
- Keep an updated medication list (including OTC and supplements)
- Use pill organizers if taking multiple medications
- Never share prescriptions with others
- Dispose of expired medications properly (many pharmacies have take-back programs)""",
    "diet": """**DISCLAIMER: I am an AI assistant, not a dietitian. Consult a healthcare provider before making significant dietary changes.**

## General Wellness & Nutrition Guidelines

### Balanced Diet Basics:
- **Vegetables & Fruits**: Fill half your plate with colorful produce
- **Whole Grains**: Choose brown rice, quinoa, oats over refined grains
- **Lean Protein**: Fish, poultry, legumes, nuts, tofu
- **Healthy Fats**: Avocado, olive oil, nuts, fatty fish
- **Limit**: Processed foods, added sugars, excessive sodium

### Physical Activity:
- **Adults**: 150 min moderate or 75 min vigorous activity per week
- **Strength training**: 2+ days per week
- **Break up sitting**: Stand or walk every 30 minutes

### Sleep:
- **Adults**: 7-9 hours per night
- **Hygiene**: Consistent schedule, dark/cool room, no screens 1hr before bed
- Avoid caffeine after 2pm and large meals before bedtime

### Stress Management:
- Deep breathing (4-7-8 technique)
- Regular exercise
- Social connections
- Adequate sleep
- Mindfulness or meditation""",
}

class MedicalAgent(BaseAgent):
    def __init__(self):
        super().__init__(MEDICAL_PROMPT, MEDICAL_FALLBACKS)

    def advise(self, query: str, context: list | None = None) -> str:
        return self.run(query, context)
