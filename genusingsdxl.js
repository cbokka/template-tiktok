const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const huggingfaceApiKey = "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";
const huggingfaceInferenceApiModel = "sd-community/sdxl-flash";
const huggingfaceInferenceApiFileType = "image/jpeg";

const nbInferenceSteps = 8;
const guidanceScale = 3;

const presets = {
    stockphoto: {
        id: "stockphoto",
        label: "Stock photo",
        family: "european",
        color: "color",
        font: "actionman",
        llmPrompt: "new movie",
        imagePrompt: (prompt) => [
            `cinematic`,
            `hyperrealistic`,
            `footage`,
            `sharp 8k`,
            `analog`,
            `instagram`,
            `photoshoot`,
            `${prompt}`,
            `crisp details`
        ],
        negativePrompt: () => [
            "manga",
            "anime",
            "american comic",
            "grayscale",
            "monochrome",
            "painting",
            "spelling mistakes",
            "(deformed, distorted, disfigured:1.3)", 
            "poorly drawn",
            "bad anatomy", 
            "wrong anatomy",
            "extra limb", 
            "missing limb", 
            "floating limbs", 
            "(mutated hands and fingers:1.4)", 
            "disconnected limbs", 
            "mutation", 
            "mutated", 
            "ugly", 
            "disgusting", 
            "blurry", 
            "amputation",
             "NSFW",
             "text",
        ],
    },
};

async function importFetch() {
    return (await import('node-fetch')).default;
}

async function generateImage(preset, prompt, width, height) {
    const fetch = await importFetch();
    
    const positivePrompt = preset.imagePrompt(prompt).join(", ");

    const res = await fetch(`https://api-inference.huggingface.co/models/${huggingfaceInferenceApiModel}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: huggingfaceInferenceApiFileType,
            Authorization: `Bearer ${huggingfaceApiKey}`,
        },
        body: JSON.stringify({
            inputs: positivePrompt,
            parameters: {
                num_inference_steps: nbInferenceSteps,
                guidance_scale: guidanceScale,
                width,
                height,
                wait_for_model: true,
            }
        }),
        cache: "no-store",
    });

    if (res.status !== 200) {
        const content = await res.text();
        console.error(content);
        throw new Error('Failed to fetch data');
    }

    const blob = await res.arrayBuffer();
    const contentType = res.headers.get('content-type');
    let assetUrl = `data:${contentType};base64,${Buffer.from(blob).toString('base64')}`;

    return {
        renderId: uuidv4(),
        status: "completed",
        assetUrl,
        alt: prompt,
        error: "",
        maskUrl: "",
        segments: [],
        blob
    };
}

function saveImage(image, outputDir) {
    const imageFilePath = path.join(outputDir, `${image.renderId}.jpeg`);
    const base64Data = image.assetUrl.split(',')[1];
    fs.writeFileSync(imageFilePath, base64Data, 'base64');
    return `${image.renderId}.jpeg`;
}

async function processPrompts(inputFile, width, height, outputDir, preset) {
    const prompts = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const images = [];

    for (const entry of prompts.flat()) { // Flatten the array
        const image = await generateImage(preset, entry.prompt, width, height);
        const imageName = saveImage(image, outputDir);
        entry.image = imageName;
        images.push(image);
    }

    fs.writeFileSync(inputFile, JSON.stringify(prompts, null, 2));
    return images;
}

async function retryProcessPrompts(inputFile, width, height, outputDir, preset, retries = 3) {
    let attempt = 0;

    while (attempt < retries) {
        try {
            if (fs.existsSync(outputDir)) {
                fs.rmSync(outputDir, { recursive: true, force: true });
            }
            fs.mkdirSync(outputDir);

            console.log(`Attempt ${attempt + 1} to process prompts.`);
            const images = await processPrompts(inputFile, width, height, outputDir, preset);
            return images;
        } catch (error) {
            console.error(`Error processing prompts on attempt ${attempt + 1}:`, error);
            attempt++;
        }
    }

    throw new Error(`Failed to process prompts after ${retries} attempts.`);
}

async function markImagesDownloadComplete(inputFilePath, uuid) {
    const data = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));

    for (let item of data) {
        if (item.uuid === uuid) {
            item.imagesDownload = 'complete';
            break;
        }
    }

    fs.writeFileSync(inputFilePath, JSON.stringify(data, null, 2));
}

const outputDir = './public/output';
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const preset = presets.stockphoto;

retryProcessPrompts('./public/imageprompt_f3a49d32-9f7d-4f2d-8137-3d5a6a9e8f4b.json', 1024, 1024, outputDir, preset);

module.exports = { retryProcessPrompts, outputDir, preset, markImagesDownloadComplete };
