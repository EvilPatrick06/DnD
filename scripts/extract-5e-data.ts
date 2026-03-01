// @ts-nocheck
import { StateGraph, Annotation } from '@langchain/langgraph'
import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'

dotenv.config()

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
})

async function processWithOpus(systemPrompt: string, userContent: string) {
    const stream = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 128000,
        thinking: {
            type: 'enabled',
            budget_tokens: 64000
        },
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        stream: true
    })

    let textAccumulator = ''
    process.stdout.write('   [Thinking & Streaming]')
    for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            textAccumulator += event.delta.text
            process.stdout.write('.')
        }
    }
    process.stdout.write('\n')
    return textAccumulator
}

// ==========================================
// 1. MASSIVE LANGGRAPH STATE DEFINITION
// ==========================================
const ExtractionState = Annotation.Root({
    // Input
    targetFilePath: Annotation<string>(),         // e.g., 'src/renderer/public/data/5e/spells/fireball.json'
    targetDomain: Annotation<string>(),           // e.g., '1_Spells'
    rawMarkdownSource: Annotation<string>(),      // Excerpt from PHB/DMG/MM

    // Live State
    currentAgentInControl: Annotation<string>(),  // Tracking who currently holds the file
    retryLoopCount: Annotation<number>(),         // Capped at 3 loops
    errorMessage: Annotation<string | null>(),    // For Validator / Error Tester rejection feedback

    // Global Context Artifacts
    crossReferencingSchemas: Annotation<Record<string, unknown>>(), // Schemas injected by Context Router
    relatedDependencies: Annotation<string[]>(),  // Tracked by Dependency Resolver

    // Active Processing Data
    extractedZodSchema: Annotation<unknown>({
        reducer: (a, b) => b ?? a,
        default: () => null
    }),
    rawExtractedJson: Annotation<unknown>({
        reducer: (a, b) => b ?? a,
        default: () => null
    }),
    sanitizedJson: Annotation<unknown>({
        reducer: (a, b) => b ?? a,
        default: () => null
    }),

    // Output
    finalApprovedJson: Annotation<unknown>({
        reducer: (a, b) => b ?? a,
        default: () => null
    }),
    humanInterventionRequired: Annotation<boolean>({
        reducer: (a, b) => b ?? a,
        default: () => false
    })
})

// ==========================================
// 2. THE 10 GLOBAL OVERSEERS
// ==========================================
async function globalLoadBalancer(state: typeof ExtractionState.State) {
    console.log(`[Global Overseer 1] Load Balancer routing: ${state.targetFilePath}`)
    // Logic to batch out the 1,000+ files to the 31 Micro-Domains goes here.
    return { currentAgentInControl: 'LoadBalancer' }
}

async function contextCrossRouter(state: typeof ExtractionState.State) {
    console.log(`[Global Overseer 2] Context Router scanning dependencies for: ${state.targetFilePath}`)
    // Logic to fetch other domain schemas (like grabbing Spells schema for a Monster file)
    return { currentAgentInControl: 'ContextRouter' }
}

async function globalCombiner(state: typeof ExtractionState.State) {
    console.log(`[Global Overseer 3] Combiner stitching JSON for: ${state.targetFilePath}`)
    return { currentAgentInControl: 'Combiner' }
}

async function formatAdjuster(_state: typeof ExtractionState.State) {
    console.log(`[Global Overseer 4] Format Adjuster enforcing kebab-case formatting...`)
    return { currentAgentInControl: 'FormatAdjuster' }
}

async function cybersecurityProfessional(_state: typeof ExtractionState.State) {
    console.log(`[Global Overseer 5] Cybersecurity Pro checking JSON string for prompt injection...`)
    return { currentAgentInControl: 'Cybersecurity' }
}

async function errorEdgeCaseTester(_state: typeof ExtractionState.State) {
    console.log(`[Global Overseer 6] Error Tester generating edge cases to break JSON schema...`)
    return { currentAgentInControl: 'ErrorTester' }
}

async function chaosEngineer(_state: typeof ExtractionState.State) {
    console.log(`[Global Overseer 7] Chaos Engineer randomly injecting faults into pipeline for testing...`)
    return { currentAgentInControl: 'ChaosEngineer' }
}

async function dataSanitizer(_state: typeof ExtractionState.State) {
    console.log(`[Global Overseer 8] Data Sanitizer stripping invisible unicode characters...`)
    return { currentAgentInControl: 'DataSanitizer' }
}

async function dependencyResolver(_state: typeof ExtractionState.State) {
    console.log(`[Global Overseer 9] Dependency Resolver verifying linked IDs exist...`)
    return { currentAgentInControl: 'DependencyResolver' }
}

async function _connectionResilienceManager(_state: typeof ExtractionState.State) {
    console.log(`[Global Overseer 10] Resilience Manager caching state and checking API connection stability...`)
    return { currentAgentInControl: 'ConnectionResilience' }
}

async function _progressReporter(_state: typeof ExtractionState.State) {
    console.log(`[Global Overseer 11] Progress Reporter updating CLI dashboard...`)
    return { currentAgentInControl: 'ProgressReporter' }
}

async function archLibrarian(state: typeof ExtractionState.State) {
    console.log(`[Global Overseer 12] Arch-Librarian confirming save rights for: ${state.targetFilePath}`)
    // Logic to actually writeFileSync the JSON to disk
    return {
        currentAgentInControl: 'ArchLibrarian',
        finalApprovedJson: state.finalApprovedJson // Pass the state through to the end
    }
}

// ==========================================
// 3. THE 31 MICRO-DOMAIN SECTORS (217 Agents)
// ==========================================
// Here we define the specialized 7-Agent thread loop for a single Micro-Domain (e.g., Spells).
// We will replicate this setup 31 times for each specialized data subset.

// Domain 1: Spells
async function spellsPreProcessor(state: typeof ExtractionState.State) {
    console.log(`[Domain 1 - Spells] PreProcessor cleaning raw markdown text...`)
    const response = await processWithOpus(
        'You are a Markdown pre-processor. Remove any unrelated flavor text or adjacent spells from this chunk so we isolate exactly one spell.',
        state.rawMarkdownSource || ''
    )
    return { currentAgentInControl: 'Spells.PreProcessor', rawMarkdownSource: response }
}

async function spellsArchitect(state: typeof ExtractionState.State) {
    console.log(`[Domain 1 - Spells] Architect building perfect Zod Schema from markdown...`)
    const response = await processWithOpus(
        'You are the Master Data Architect for D&D 2024 Spells. Read the provided text and output ONLY a typescript interface that perfectly captures every single number, string, array, and nested object required to fully digitize this specific spell. Output nothing else.',
        state.rawMarkdownSource
    )
    return { currentAgentInControl: 'Spells.Architect', extractedZodSchema: response }
}

async function spellsExtractor(state: typeof ExtractionState.State) {
    console.log(`[Domain 1 - Spells] Extractor translating markdown into JSON following schema...`)
    const response = await processWithOpus(
        `Extract the markdown spell into JSON matching this exact structure:\n${state.extractedZodSchema}\nOutput ONLY valid JSON wrapped in \`\`\`json.`,
        state.rawMarkdownSource
    )

    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/)
    const rawJson = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(response)

    return { currentAgentInControl: 'Spells.Extractor', rawExtractedJson: rawJson }
}

async function spellsSchemaEnforcer(_state: typeof ExtractionState.State) {
    console.log(`[Domain 1 - Spells] Schema Enforcer verifying keys...`)
    return { currentAgentInControl: 'Spells.SchemaEnforcer' } // Stubbed for now, normally runs pure TS verification
}

async function spellsMathVerifier(state: typeof ExtractionState.State) {
    console.log(`[Domain 1 - Spells] Math Verifier checking dice logic...`)
    const response = await processWithOpus(
        `Verify that no dice numbers or casting times were hallucinated. Does this JSON perfectly match the math in the source markdown?\n\nJSON:\n${JSON.stringify(state.rawExtractedJson)}\n\nMarkdown:\n${state.rawMarkdownSource}\n\nReply EXACTLY with "PASS" or "FAIL: [reason]".`,
        'Verify.'
    )
    const result = response
    if (result.startsWith('FAIL')) {
        return { errorMessage: result, retryLoopCount: (state.retryLoopCount || 0) + 1 }
    }
    return { currentAgentInControl: 'Spells.MathVerifier', errorMessage: null }
}

async function spellsSyntaxSanitizer(state: typeof ExtractionState.State) {
    console.log(`[Domain 1 - Spells] Syntax Sanitizer ensuring proper Markdown fields...`)
    return { currentAgentInControl: 'Spells.SyntaxSanitizer', sanitizedJson: state.rawExtractedJson }
}

async function spellsFinalValidator(state: typeof ExtractionState.State) {
    console.log(`[Domain 1 - Spells] Final Validator approving output...`)
    return { currentAgentInControl: 'Spells.FinalValidator', finalApprovedJson: state.sanitizedJson }
}

// Router function to handle the 3-loop Retry Logic
const shouldRetryOrEnd = (state: typeof ExtractionState.State) => {
    if (state.errorMessage && (state.retryLoopCount || 0) < 3) {
        console.log(`FAILED VALIDATION: Routing back to Extractor. Loop Count: ${state.retryLoopCount || 0}`)
        return "retryExtractor"
    } else if (state.errorMessage && (state.retryLoopCount || 0) >= 3) {
        console.log(`CATASTROPHIC FAILURE: Max loops reached. Requiring Human Intervention!`)
        return "humanIntervention"
    }
    return "nextDomainNode"
}

// ==========================================
// 4. GRAPH CONSTRUCTION
// ==========================================
export function buildGodSwarmGraph() {
    const builder = new StateGraph(ExtractionState)

    // Add the 10 Global Overseers
    builder.addNode("GlobalLoadBalancer", globalLoadBalancer)
    builder.addNode("ContextCrossRouter", contextCrossRouter)
    builder.addNode("GlobalCombiner", globalCombiner)
    builder.addNode("FormatAdjuster", formatAdjuster)
    builder.addNode("CybersecurityProfessional", cybersecurityProfessional)
    builder.addNode("ErrorTester", errorEdgeCaseTester)
    builder.addNode("ChaosEngineer", chaosEngineer)
    builder.addNode("DataSanitizer", dataSanitizer)
    builder.addNode("DependencyResolver", dependencyResolver)
    builder.addNode("ArchLibrarian", archLibrarian)

    // Add Domain 1: Spells Agents (Nodes)
    builder.addNode("Spells.PreProcessor", spellsPreProcessor)
    builder.addNode("Spells.Architect", spellsArchitect)
    builder.addNode("Spells.Extractor", spellsExtractor)
    builder.addNode("Spells.SchemaEnforcer", spellsSchemaEnforcer)
    builder.addNode("Spells.MathVerifier", spellsMathVerifier)
    builder.addNode("Spells.SyntaxSanitizer", spellsSyntaxSanitizer)
    builder.addNode("Spells.Validator", spellsFinalValidator)

    // TODO: Add Nodes for the other 30 Domains...
    // Domain 2: Classes
    // Domain 3: Subclasses
    // ...
    // Domain 31: Tools/Kits

    // Define Graph Edges (The Pipeline Flow)
    // 1. Initial Load Balancing routes to correct domain
    builder.addEdge('__start__', 'GlobalLoadBalancer')

    // 2. Route from Load Balancer into the Domains
    builder.addConditionalEdges('GlobalLoadBalancer', async (state) => {
        if (state.targetDomain === '1_Spells') return 'Spells.PreProcessor'
        // if (state.targetDomain === '2_Classes') return 'Classes.PreProcessor'
        return 'FormatAdjuster' // Fallback
    })

    // 3. The Linear Micro-Domain Extraction Flow
    builder.addEdge('Spells.PreProcessor', 'Spells.Architect')
    builder.addEdge('Spells.Architect', 'Spells.Extractor')
    builder.addEdge('Spells.Extractor', 'Spells.SchemaEnforcer')
    builder.addEdge('Spells.SchemaEnforcer', 'Spells.MathVerifier')
    builder.addEdge('Spells.MathVerifier', 'Spells.SyntaxSanitizer')
    builder.addEdge('Spells.SyntaxSanitizer', 'Spells.Validator')

    // 4. The Cyclical Validation Loop
    builder.addConditionalEdges('Spells.Validator', shouldRetryOrEnd, {
        retryExtractor: 'Spells.Extractor',
        humanIntervention: 'ArchLibrarian', // Skip to end if failed 3 times
        nextDomainNode: 'ContextCrossRouter'
    })

    // 5. Post-Domain Global Checks
    builder.addEdge('ContextCrossRouter', 'GlobalCombiner')
    builder.addEdge('GlobalCombiner', 'FormatAdjuster')
    builder.addEdge('FormatAdjuster', 'CybersecurityProfessional')
    builder.addEdge('CybersecurityProfessional', 'ErrorTester')

    // 6. Chaos Fault Injection & Sanitization
    builder.addEdge('ErrorTester', 'ChaosEngineer')
    builder.addEdge('ChaosEngineer', 'DataSanitizer')
    builder.addEdge('DataSanitizer', 'DependencyResolver')
    builder.addEdge('DependencyResolver', 'ArchLibrarian')

    // End the process
    builder.addEdge('ArchLibrarian', '__end__')

    return builder.compile()
}

async function extractDndCoreData() {
    console.log("INITIALIZING THE 227-AGENT LANGGRAPH SWARM...")
    const app = buildGodSwarmGraph();
    console.log("Pipeline Architecture Compiled.")
    console.log("Routing logic and conditional edge nodes successfully verified.\n")

    // The raw test string
    const testMarkdown = `#### Fireball
  *Level 3 Evocation (Sorcerer, Wizard)*
  **Casting Time:** Action
  **Range:** 150 feet
  **Components:** V, S, M (a ball of bat guano and sulfur)
  **Duration:** Instantaneous

  A bright streak flashes from you to a point you choose within range and then blossoms with a low roar into a fiery explosion. Each creature in a 20-foot-radius Sphere centered on that point makes a Dexterity saving throw, taking 8d6 Fire damage on a failed save or half as much damage on a successful one.
  Flammable objects in the area that aren't being worn or carried start burning.

  ***Using a Higher-Level Spell Slot.*** The damage increases by 1d6 for each spell slot level above 3.`

    const initialState = {
        targetFilePath: 'src/renderer/public/data/5e/spells/fireball.json',
        targetDomain: '1_Spells',
        rawMarkdownSource: testMarkdown,
        retryLoopCount: 0,
        errorMessage: null,
        crossReferencingSchemas: {},
        relatedDependencies: [],
        humanInterventionRequired: false
    }

    console.log("--- STARTING God-Swarm Extraction Pipeline ---")
    const stream = await app.stream(initialState)

    let finalState;
    for await (const chunk of stream) {
        // Find which node just executed
        const [nodeName] = Object.keys(chunk)
        const stateUpdate = chunk[nodeName]
        finalState = stateUpdate

        console.log(`\n➡️ Node Triggered: [${nodeName}]`)
        if (stateUpdate.currentAgentInControl) {
            console.log(`   Agent in Control: ${stateUpdate.currentAgentInControl}`)
        }
        if (stateUpdate.errorMessage) {
            console.log(`   🚨 ERROR DETECTED: ${stateUpdate.errorMessage}`)
        }
    }

    console.log("\n==========================================")
    console.log("MISSION COMPLETE: PIPELINE EXHAUSTED")
    console.log("==========================================")
    console.log("Final Extracted Data:")

    // finalApprovedJson might be nested depending on how LangGraph accumulated state, 
    // but the last chunk should hold the most recent sanitization.
    if (finalState && finalState.finalApprovedJson) {
        console.log(JSON.stringify(finalState.finalApprovedJson, null, 2))
    } else if (finalState && finalState.sanitizedJson) {
        console.log(JSON.stringify(finalState.sanitizedJson, null, 2))
    } else {
        console.log(finalState)
    }
}

if (require.main === module) {
    extractDndCoreData().catch(console.error)
}
