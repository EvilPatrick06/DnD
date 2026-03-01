import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config();

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

async function debug() {
    const results = await anthropic.messages.batches.results('msgbatch_01RUK7ppD2JWZUJXv5hzpcxU');
    const out = [];
    for await (const result of results) {
        if (result.result.type === 'succeeded') {
            out.push({
                custom_id: result.custom_id,
                text: (result.result.message.content[0] as any).text
            });
        }
    }
    fs.writeFileSync('debug-batch.json', JSON.stringify(out, null, 2));
    console.log("Saved debug to debug-batch.json");
}

debug().catch(console.error);
