import { useState } from 'react'

// DMG 2024 Ch4 — Adventure Situations by Level Tier
const ADVENTURE_SEEDS: Record<string, string[]> = {
  '1-4': [
    'A dragon wyrmling has gathered a band of kobolds to help it amass a hoard.',
    'Wererats living in a city\'s sewers plot to take control of the governing council.',
    'Bandit activity signals efforts to revive an evil cult long ago driven from the region.',
    'A pack of gnolls is rampaging dangerously close to local farmlands.',
    'A rivalry between two merchant families escalates from mischief to mayhem.',
    'A new sinkhole has revealed a long-buried dungeon thought to hold treasure.',
    'Miners discovered an underground ruin and were captured by monsters living there.',
    'An innocent person is being framed for the crimes of a shape-shifting monster.',
    'Ghouls are venturing out of the catacombs at night.',
    'A notorious criminal hides from the law in an old ruin or abandoned mine.',
    'A contagion in a forest is causing spiders to grow massive and become aggressive.',
    'To take revenge against a village for an imagined slight, a necromancer has been animating the corpses in the village cemetery.',
    'An evil cult is spreading in a village. Those who oppose the cult are marked for sacrifice.',
    'An abandoned house on the edge of town is haunted by Undead because of a cursed item in the house.',
    'Creatures from the Feywild enter the world and cause mischief and misfortune among villagers and their livestock.',
    'A hag\'s curse is making animals unusually aggressive.',
    'Bullies have appointed themselves the village militia and are extorting money and food from villagers.',
    'After a local fisher pulls a grotesque statue from the sea, aquatic monsters start attacking the waterfront at night.',
    'The ruins on the hill near the village lie under a curse, so people don\'t go there—except a scholar who wants to study the ruins.',
    'A new captain has taken charge of a band of pirates or bandits and started raiding more frequently.'
  ],
  '5-10': [
    'A group of cultists has summoned a demon to wreak havoc in the city.',
    'A rebel lures monsters to the cause with the promise of looting the king\'s treasury.',
    'An evil Artifact has transformed a forest into a dismal swamp full of horrific monsters.',
    'An Aberration living in the Underdark sends minions to capture people from the surface to turn those people into new minions.',
    'A monster (perhaps a devil, slaad, or hag) is impersonating a prominent noble to throw the realm into civil war.',
    'A master thief plans to steal royal regalia.',
    'A golem intended to serve as a protector has gone berserk and captured its creator.',
    'A conspiracy of spies, assassins, and necromancers schemes to overthrow a ruler.',
    'After establishing a lair, a young dragon is trying to earn the fear and respect of other creatures living nearby.',
    'The approach of a lone giant alarms the people of a town, but the giant is simply looking for a place to live in peace.',
    'An enormous monster on display in a menagerie breaks free and goes on a rampage.',
    'A coven of hags steals cherished memories from travelers.',
    'A villain seeks powerful magic in an ancient ruin, hoping to use it to conquer the region.',
    'A scheming aristocrat hosts a masquerade ball, which many guests see as an opportunity to advance their own agendas.',
    'A ship carrying a valuable treasure or an evil Artifact sinks in a storm or monster attack.',
    'A natural disaster was actually caused by magic gone awry or a cult\'s villainous plans.',
    'A secretive cult uses spies to heighten tensions between two rival nations, hoping to provoke a war.',
    'Rebels or forces of an enemy nation have kidnapped an important noble.',
    'The descendants of a displaced people want to reclaim their ancestral city, which is now inhabited by monsters.',
    'A renowned group of adventurers never returned from an expedition to a famous ruin.'
  ],
  '11-16': [
    'A portal to the Abyss opens in a cursed location and spews demons into the world.',
    'A band of hunting giants has driven its prey—enormous beasts—into pastureland.',
    'An adult dragon\'s lair is transforming an expanse into an environment inhospitable to the other creatures living there.',
    'A long-lost journal describes an incredible journey to a hidden subterranean realm full of magical wonders.',
    'Cultists hope to persuade a dragon to undergo the rite that will transform it into a dracolich.',
    'The ruler of the realm is sending an emissary to a hostile neighbor to negotiate a truce, and the emissary needs protection.',
    'A castle or city has been drawn into another plane of existence.',
    'A storm tears across the land, with a mysterious flying citadel in the eye of the storm.',
    'Two parts of a magic item are in the hands of bitter enemies; the third piece is lost.',
    'Evil cultists gather from around the world to summon a monstrous god or alien entity.',
    'A tyrannical ruler outlaws the use of magic without official sanction. A secret society of spellcasters seeks to oust the tyrant.',
    'During a drought, low water levels in a lake reveal previously unknown ancient ruins that contain a powerful evil.'
  ],
  '17-20': [
    'An ancient dragon is scheming to destroy a god and take the god\'s place in the pantheon.',
    'A band of giants drove away a metallic dragon and took over the dragon\'s lair.',
    'An ancient hero returns from the dead to prepare the world for the return of an equally ancient monster.',
    'An ancient Artifact has the power to defeat or imprison a rampaging titan.',
    'A god of agriculture is angry, causing rivers to dry up and crops to wither.',
    'An Artifact belonging to a god falls into mortal hands.',
    'A titan imprisoned in the Underdark begins to break free, causing terrible earthquakes.',
    'A lich tries to exterminate any spellcasters that approach the lich\'s level of power.',
    'A holy temple was built around a portal leading to one of the Lower Planes to prevent evil from passing through.',
    'A primordial force of nature awakens and threatens to consume entire continents.'
  ]
}

interface AdventureData {
  title: string
  levelTier: string
  premise: string
  hook: string
  villain: string
  setting: string
  playerStakes: string
  encounters: string
  climax: string
  resolution: string
}

const EMPTY_ADVENTURE: AdventureData = {
  title: '',
  levelTier: '1-4',
  premise: '',
  hook: '',
  villain: '',
  setting: '',
  playerStakes: '',
  encounters: '',
  climax: '',
  resolution: ''
}

interface AdventureWizardProps {
  onSave: (adventure: AdventureData) => void
  onCancel: () => void
}

export default function AdventureWizard({ onSave, onCancel }: AdventureWizardProps): JSX.Element {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<AdventureData>({ ...EMPTY_ADVENTURE })

  const update = (field: keyof AdventureData, value: string): void => {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  const rollSeed = (): void => {
    const seeds = ADVENTURE_SEEDS[data.levelTier]
    const seed = seeds[Math.floor(Math.random() * seeds.length)]
    update('premise', seed)
  }

  const steps = [
    {
      title: 'Step 1: Lay Out the Premise',
      description: 'Define the adventure hook, villain or situation, and setting.',
      content: (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Adventure Title</label>
            <input
              value={data.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder="The Lost Mine of..."
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Level Tier</label>
            <div className="flex gap-1.5">
              {Object.keys(ADVENTURE_SEEDS).map((tier) => (
                <button
                  key={tier}
                  onClick={() => update('levelTier', tier)}
                  className={`flex-1 py-1.5 text-xs rounded cursor-pointer border transition-colors ${
                    data.levelTier === tier
                      ? 'bg-amber-600/20 border-amber-500/40 text-amber-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Lvl {tier}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-gray-500 uppercase tracking-wide">Premise / Situation</label>
              <button
                onClick={rollSeed}
                className="text-[10px] text-purple-400 hover:text-purple-300 cursor-pointer"
              >
                Roll Random Seed
              </button>
            </div>
            <textarea
              value={data.premise}
              onChange={(e) => update('premise', e.target.value)}
              placeholder="What is going on? What situation will the characters encounter?"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Villain / Antagonist</label>
            <input
              value={data.villain}
              onChange={(e) => update('villain', e.target.value)}
              placeholder="Who or what is the primary threat?"
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Setting / Location</label>
            <input
              value={data.setting}
              onChange={(e) => update('setting', e.target.value)}
              placeholder="Where does this adventure take place?"
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200"
            />
          </div>
        </div>
      )
    },
    {
      title: 'Step 2: Draw In the Players',
      description: 'Define personal stakes and connections to backstories.',
      content: (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Adventure Hook</label>
            <textarea
              value={data.hook}
              onChange={(e) => update('hook', e.target.value)}
              placeholder="How do the characters learn about this adventure? A patron, a rumor, a supernatural omen?"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Personal Stakes</label>
            <textarea
              value={data.playerStakes}
              onChange={(e) => update('playerStakes', e.target.value)}
              placeholder="What connections do the characters have to this situation? How does it affect people they care about?"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 resize-none"
            />
          </div>
        </div>
      )
    },
    {
      title: 'Step 3: Plan Encounters',
      description: 'Outline the combat, social, and exploration encounters.',
      content: (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">
              Key Encounters (combat, social, exploration)
            </label>
            <textarea
              value={data.encounters}
              onChange={(e) => update('encounters', e.target.value)}
              placeholder={"1. (Exploration) The party investigates the abandoned mine...\n2. (Social) They negotiate with the miners' guild...\n3. (Combat) Ambush by kobolds in the tunnels..."}
              rows={6}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 resize-none"
            />
          </div>
          <div className="text-[10px] text-gray-500 bg-gray-800/50 rounded p-2">
            Mix encounter types for variety. Use a blend of combat, social interaction, and exploration. Successive encounters should build tension toward the climax.
          </div>
        </div>
      )
    },
    {
      title: 'Step 4: Bring It to an End',
      description: 'Define the climax, resolution, and consequences.',
      content: (
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Climax</label>
            <textarea
              value={data.climax}
              onChange={(e) => update('climax', e.target.value)}
              placeholder="What is the final confrontation or challenge? How does tension peak?"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-wide mb-1">Resolution & Consequences</label>
            <textarea
              value={data.resolution}
              onChange={(e) => update('resolution', e.target.value)}
              placeholder="What happens after the climax? What are the consequences for success or failure? What seeds does this plant for future adventures?"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 resize-none"
            />
          </div>
        </div>
      )
    }
  ]

  const canProceed = step === 0 ? data.title.trim().length > 0 : true

  return (
    <div className="space-y-4">
      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <button
            key={i}
            onClick={() => setStep(i)}
            className={`flex-1 py-1 text-[10px] rounded cursor-pointer border transition-colors ${
              i === step
                ? 'bg-amber-600/20 border-amber-500/40 text-amber-300'
                : i < step
                  ? 'bg-green-900/20 border-green-500/30 text-green-400'
                  : 'bg-gray-800 border-gray-700 text-gray-500'
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Step Content */}
      <div>
        <h4 className="text-sm font-semibold text-gray-200">{steps[step].title}</h4>
        <p className="text-[11px] text-gray-500 mb-3">{steps[step].description}</p>
        {steps[step].content}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-800">
        <button
          onClick={step === 0 ? onCancel : () => setStep(step - 1)}
          className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-300 cursor-pointer"
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </button>
        {step < steps.length - 1 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed}
            className="px-4 py-1.5 text-xs bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded text-amber-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        ) : (
          <button
            onClick={() => onSave(data)}
            className="px-4 py-1.5 text-xs bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded text-green-300 cursor-pointer"
          >
            Save Adventure
          </button>
        )}
      </div>
    </div>
  )
}

export type { AdventureData }
