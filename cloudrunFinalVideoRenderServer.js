const express = require('express');
const { bundle } = require('@remotion/bundler');
const { renderMedia, selectComposition } = require('@remotion/renderer');
const path = require('path');
const fs = require('fs').promises;
const { processTranscription } = require('./generatePrompts');
const { retryProcessPrompts, outputDir, preset, markImagesDownloadComplete } = require('./generateImages');
const { convertCharToWordLevel } = require('./gensub');
const webpackOverride = require('./src/webpack-override.js');

// Define the composition ID from your RemotionRoot
const compositionId = 'CaptionedVideo';

// Create an Express app
const app = express();
const port = process.env.PORT || 3001;

// Middleware to parse JSON bodies
app.use(express.json());

// Helper function to get the current date as a string in YYYY-MM-DD format
const getCurrentDate = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

// Function to render your video composition
const renderComposition = async (inputProps, uuid, dateFolder) => {
  try {
    const bundleLocation = await bundle({
      entryPoint: path.resolve('./src/index.ts'),
      webpackOverride,
    });

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    const outputLocation = `/mnt/disks/bbnews/${dateFolder}/${uuid}.mp4`;
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

const generateSubtitles = async (charData, uuid, dateFolder) => {
  const subtitleFilePath = path.join(`/mnt/disks/bbnews/${dateFolder}`, `${uuid}_subtitles.json`);
  await convertCharToWordLevel(charData, subtitleFilePath);
  return subtitleFilePath;
};

const ensureDirExists = async (dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err;
    }
  }
};

app.post('/render-video', async (req, res) => {
  const { filePath } = req.body;
  const dateFolder = getCurrentDate();

  try {
    await ensureDirExists(`/mnt/disks/bbnews/${dateFolder}`);
    const jsonArray = JSON.parse(await fs.readFile(filePath, 'utf8'));

    for (let i = 0; i < jsonArray.length; i++) {
      const item = jsonArray[i];

      const videoFilePath = path.join(`/mnt/disks/bbnews/${dateFolder}`, `${item.uuid}.mp4`);
      if (await fs.access(videoFilePath).then(() => true).catch(() => false)) {
        console.log(`Skipping already processed item: ${videoFilePath}`);
        continue;
      }

      const subtitleFilePath = await generateSubtitles(item.charData, item.uuid, dateFolder);
      await ensureDirExists(`/mnt/disks/bbnews/${dateFolder}`);

      const imagePromptFilePath = await processTranscription(subtitleFilePath, 2000, item.uuid);

      if (!item.imagesDownload || item.imagesDownload !== 'complete') {
        await retryProcessPrompts(imagePromptFilePath, 1024, 1024, outputDir, preset);
        await markImagesDownloadComplete(filePath, item.uuid);
      } else {
        console.log(`Images already downloaded for UUID: ${item.uuid}`);
      }

      const srcPath = path.join(`/mnt/disks/bbnews/${dateFolder}`, `${item.uuid}.mp4`);
      if (!await fs.access(srcPath).then(() => true).catch(() => false)) {
        throw new Error(`Source video file does not exist: ${srcPath}`);
      }

      const inputProps = {
        src: srcPath,
      };
      const renderedFilePath = await renderComposition(inputProps, item.uuid, dateFolder);
      item.videoFilePath = renderedFilePath;
    }

    await fs.writeFile(filePath, JSON.stringify(jsonArray, null, 2));
    console.log(`Updated JSON file saved to ${filePath}`);

    res.status(200).json({ message: 'Render done!' });
  } catch (error) {
    console.error('Error in render-video route:', error);
    res.status(500).json({ message: 'Error rendering video', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});