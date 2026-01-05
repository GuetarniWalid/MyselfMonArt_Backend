import { z } from 'zod'

export default class ColorPatternFormatter {
  public prepareRequest(availableColors: string[]) {
    return {
      responseFormat: this.getResponseFormat(),
      systemPrompt: this.getSystemPrompt(),
      userPrompt: this.getUserPrompt(availableColors),
    }
  }

  public getResponseFormat() {
    return z.object({
      colors: z.array(z.string()).max(3).describe('Array of detected color names (max 3)'),
      reasoning: z.string().optional().describe('Brief explanation of color choices'),
    })
  }

  public getSystemPrompt() {
    return `You are categorizing paintings for an e-commerce color filter system.

🎯 YOUR ONLY JOB: Return colors that define this painting's appearance.

⚠️ CORE RULE - Apply this test to EVERY color before including it:
"If a customer filters the store by THIS color, would they be HAPPY to see this painting in the results?"

If the answer is NO or MAYBE → DO NOT include that color.
If the answer is YES (absolutely) → Include it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DOMINANCE STANDARD:
• A color must occupy 25-30%+ of the canvas to qualify
• Small details, accents, and "present but minor" colors → EXCLUDE THEM
• Empty array [] is valid when no available color is truly dominant

RARE EXCEPTION (use maybe 1 in 20 paintings):
• A vivid/neon color (10-15%) against a muted background CAN qualify IF:
  - It's the FIRST thing your eye sees
  - It's bright/saturated enough to "glow" or "pop"
  - Someone would say "that's the painting with the [color]"
• Max 1 such color per painting

MULTICOLOR:
• If the painting is vibrant/colorful (4+ distinct bright colors): include "multicolor"
• Can combine with 1-2 dominant solid colors: ["multicolor", "Bleu", "Rouge"]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLES:

❌ Blue sky (70%) + green trees (20%) + red flowers (10%)
→ WRONG: ["Bleu", "Vert", "Rouge"]
→ RIGHT: ["Bleu"] only
→ Why: Customer filtering "Rouge" would be disappointed - red is barely visible

❌ Purple painting (80%) with small yellow details (5%)
→ WRONG: ["Violet", "Jaune"] (but Violet not in list → ["Jaune"])
→ RIGHT: [] empty array
→ Why: Yellow is just details. Purple (dominant) not available → return nothing

✅ Gray landscape (60%) with NEON red poppies (15%) that immediately catch the eye
→ RIGHT: ["Gris", "Rouge"]
→ Why: Red is vivid and memorable despite small area

✅ Colorful abstract (red 25%, blue 20%, yellow 20%, green 20%)
→ RIGHT: ["multicolor", "Rouge"]
→ Why: Vibrant + red slightly dominant

❌ Beige background (50%) + orange flowers (25%) + yellow flowers (25%)
→ WRONG: ["Beige / Crème", "Orange", "Jaune"]
→ RIGHT: ["Beige / Crème"] only
→ Why: Orange and yellow blend together (warm tones), neither is distinctly dominant

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DECISION PROCESS (for each potential color):
1. Does it occupy 25%+ of the canvas? → If NO, skip (unless vivid exception applies)
2. Is it available in the provided list? → If NO, skip
3. Final test: "Would a customer filtering by this color be happy with this result?"
   → If NO → exclude it
   → If YES → include it

DEFAULT: When in doubt, EXCLUDE the color. Better to return 1 correct color than 3 questionable ones.

Return exact color names from the provided list. Max 3 colors total.`
  }

  public getUserPrompt(availableColors: string[]) {
    return `AVAILABLE COLORS (choose ONLY from this list):
${availableColors.map((c) => `- ${c}`).join('\n')}

Identify colors that define this painting's appearance (25-30%+ of canvas).

⚠️ For each color, ask: "Would a customer filtering by this color be SATISFIED to see this painting?"
→ If NO or MAYBE: exclude it
→ If YES (definitely): include it

Be conservative. Return 0-3 colors maximum.`
  }
}
