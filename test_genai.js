
try {
    const genai = require('@google/genai');
    console.log(JSON.stringify(Object.keys(genai), null, 2));
} catch (e) {
    console.error('Error:', e.message);
}
