
import dotenv from 'dotenv';
import path from 'path';
import { generateSpreadRationale, generateSynthesisAndQueries } from '../lib/services/gemini';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runTest() {
    console.log('🔮 Testing Intelligence Evolution...');

    if (!process.env.GOOGLE_GEMINI_API_KEY) {
        console.error('❌ GOOGLE_GEMINI_API_KEY not found in .env.local');
        process.exit(1);
    }

    // MOCK DATA: The "Conflict" Spread
    const cards = [
        {
            name: 'The Tower',
            summary: 'Sudden change, upheaval, chaos, revelation.',
            position: 'Aware Self',
            archetypes: ['The Destroyer', 'The Awakenining'],
            themes: ['destruction', 'liberation', 'sudden change'],
        },
        {
            name: '3 of Swords',
            summary: 'Heartbreak, sorrow, grief, separation.',
            position: 'Supporting Shadow',
            archetypes: ['The Wounded Heart'],
            themes: ['grief', 'pain', 'separation'],
        },
        {
            name: 'The Sun',
            summary: 'Joy, success, celebration, positivity.',
            position: 'Emerging Path',
            archetypes: ['The Child', 'The Radiance'],
            themes: ['joy', 'success', 'vitality'],
        }
    ];

    const talk = {
        title: 'The gift and power of emotional courage',
        speakerName: 'Susan David',
        description: 'Psychologist Susan David shares how the way we deal with our emotions shapes everything that matters: our actions, careers, relationships, health and happiness.',
    };

    console.log('\n-----------------------------------');
    console.log('🧪 TEST 1: Phase 1 (Context & Rationale)');
    console.log('-----------------------------------');

    try {
        const result = await generateSpreadRationale({
            cards,
            talk,
            focusText: 'I feel like everything is falling apart.'
        });

        if (result.success) {
            console.log('✅ Rationale Generated:');
            console.log(result.text);
        } else {
            console.error('❌ Failed:', result.error);
        }
    } catch (error) {
        console.error('❌ Exception:', error);
    }

    console.log('\n-----------------------------------');
    console.log('🧪 TEST 2: Phase 2 (Synthesis & Queries)');
    console.log('-----------------------------------');

    try {
        const synthesisResult = await generateSynthesisAndQueries({
            cards,
            focusText: 'I feel like everything is falling apart.'
        });

        if ('error' in synthesisResult) {
            console.error('❌ Failed:', synthesisResult.error);
        } else {
            console.log('✅ Synthesis:');
            console.log(synthesisResult.synthesis);
            console.log('\n✅ Search Queries:');
            synthesisResult.searchQueries.forEach(q => console.log(`   - ${q}`));
        }
    } catch (error) {
        console.error('❌ Exception:', error);
    }
}

runTest();
