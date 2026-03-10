import { searchYouTube } from '../lib/services/youtube';

async function test() {
    console.log('Testing YouTube API key...');
    try {
        const data = await searchYouTube(['Never Gonna Give You Up']);
        console.log('SUCCESS! Got data:', data[0]?.title, '->', data[0]?.url);
    } catch (error) {
        console.error('FAILED!', error);
        process.exit(1);
    }
}

test();
