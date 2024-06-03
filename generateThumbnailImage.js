const fs = require('fs');
const { HfInference } = require('@huggingface/inference');
const { v4: uuidv4 } = require('uuid');

const huggingfaceApiKey = "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";
const outputDir = './public';

const generateImagesFromPrompts = async (prompts) => {
  const hf = new HfInference(huggingfaceApiKey);
  const model = 'stabilityai/stable-diffusion-2-1';

  for (const { startInSeconds, prompt } of prompts) {
    const imageResponse = await hf.textToImage({
      model,
      inputs: prompt,
    });

    const imageBuffer = Buffer.from(imageResponse.image, 'base64');
    const imageName = `${uuidv4()}.png`;
    const imagePath = `${outputDir}/${imageName}`;

    fs.writeFileSync(imagePath, imageBuffer);
    console.log(`Image saved to ${imagePath} for prompt "${prompt}" at ${startInSeconds} seconds.`);
  }
};

const inputFile = './public/imageprompt.json';

const prompts = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

generateImagesFromPrompts(prompts).then(() => {
  console.log('Image generation completed.');
}).catch(error => {
  console.error('Error generating images:', error);
});