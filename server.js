const express = require('express');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const path = require('path');
const fs = require('fs').promises;
const { processTranscription } = require('./generatePrompts');
const { retryProcessPrompts, outputDir, preset, markImagesDownloadComplete } = require('./generateImages');
const { convertCharToWordLevel } = require('./gensub');
const webpackOverride = require('./src/webpack-override.js'); // Ensure this path is correct

// Define the composition ID from your RemotionRoot
const compositionId = 'CaptionedVideo';

// Create an Express app
const app = express();
const port = 3001;

// Middleware to parse JSON bodies
app.use(express.json());

// Function to render your video composition
const renderComposition = async (inputProps, uuid) => {
  try {
    // Bundle the project
    const bundleLocation = await bundle({
      entryPoint: path.resolve('./src/index.ts'), // Update the path if necessary
      webpackOverride,
    });

    // Select the composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    // Render the media
    const outputLocation = `/Users/cbokka/Documents/newsvids/${uuid}.mp4`;
    if (await fs.access(outputLocation).then(() => true).catch(() => false)) {
      console.log(`Video already exists: ${outputLocation}`);
      return outputLocation;
    }
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation,
      inputProps,
    });

    console.log('Render done!');
    return outputLocation;
  } catch (error) {
    console.error('Error rendering composition:', error);
    throw error;
  }
};

// Function to generate subtitles
const generateSubtitles = async (charData, uuid) => {
  const subtitleFilePath = path.join('public', `${uuid}_subtitles.json`);
  await convertCharToWordLevel(charData, subtitleFilePath);
  return subtitleFilePath;
};

// Function to ensure directory exists
const ensureDirExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
};

// API endpoint to generate subtitles and render video
app.post('/render-video', async (req, res) => {
  const { filePath } = req.body;

  try {
    if (!await fs.access(filePath).then(() => true).catch(() => false)) {
      return res.status(400).json({ message: 'JSON file not found' });
    }

    const jsonArray = JSON.parse(await fs.readFile(filePath, 'utf8'));

    for (let i = 0; i < jsonArray.length; i++) {
      const item = jsonArray[i];

      // Check if the item has already been processed
      const videoFilePath = `/Users/cbokka/Documents/newsvids/${item.uuid}.mp4`;
      if (await fs.access(videoFilePath).then(() => true).catch(() => false)) {
        console.log(`Skipping already processed item: ${videoFilePath}`);
        continue;
      }

      // Generate subtitles
      const subtitleFilePath = await generateSubtitles(item.charData, item.uuid);

      // Ensure public directory exists
      await ensureDirExists('public');

      // Generate text-to-image prompts
      const imagePromptFilePath = await processTranscription(subtitleFilePath, 2000, item.uuid);

      // Generate images
      if (!item.imagesDownload || item.imagesDownload !== 'complete') {
        await retryProcessPrompts(imagePromptFilePath, 1024, 1024, outputDir, preset);
        await markImagesDownloadComplete(filePath, item.uuid);
      } else {
        console.log(`Images already downloaded for UUID: ${item.uuid}`);
      }

      // Use the provided UUID to locate the video file
      const srcPath = path.join('public', `${item.uuid}.mp4`);
      if (!await fs.access(srcPath).then(() => true).catch(() => false)) {
        throw new Error(`Source video file does not exist: ${srcPath}`);
      }

      // Use the provided MP4 file to render the video
      const inputProps = {
        src: srcPath,
      };
      const renderedFilePath = await renderComposition(inputProps, item.uuid);

      // Update item with the rendered video file path
      item.videoFilePath = renderedFilePath;
    }

    // Write the updated JSON array back to the file
    await fs.writeFile(filePath, JSON.stringify(jsonArray, null, 2));
    console.log(`Updated JSON file saved to ${filePath}`);

    res.status(200).json({ message: 'Render done!' });
  } catch (error) {
    console.error('Error in render-video route:', error);
    res.status(500).json({ message: 'Error rendering video', error: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
