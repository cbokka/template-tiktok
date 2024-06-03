import { useCallback, useEffect, useState } from 'react';
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  cancelRender,
  continueRender,
  delayRender,
  OffthreadVideo,
  Sequence,
  useVideoConfig,
  staticFile,
  Animated
} from 'remotion';
import { z } from 'zod';
import Subtitle from './Subtitle';
import { getVideoMetadata } from '@remotion/media-utils';
import { loadFont } from '../load-font';


export type SubtitleProp = {
  startInSeconds: number;
  text: string;
};

export type ImageProp = {
  startInSeconds: number;
  image: string;
};

export const captionedVideoSchema = z.object({
  src: z.string(),
});

export const calculateCaptionedVideoMetadata: CalculateMetadataFunction<
  z.infer<typeof captionedVideoSchema>
> = async ({ props }) => {
  const fps = 30;
  const metadata = await getVideoMetadata(props.src);

  return {
    fps,
    durationInFrames: Math.floor(metadata.durationInSeconds * fps),
  };
};

export const CaptionedVideo: React.FC<{
  src: string;
}> = ({ src }) => {
  const [subtitles, setSubtitles] = useState<SubtitleProp[]>([]);
  const [images, setImages] = useState<ImageProp[]>([]);
  const [handle] = useState(() => delayRender());
  const { fps } = useVideoConfig();

  const uuid = src.match(/([^/]+)(?=\.\w+$)/)?.[0];

  const subtitlesFile = uuid ? staticFile(`${uuid}_subtitles.json`) : null;
  const imagesFile = uuid ? staticFile(`imageprompt_${uuid}.json`) : null;

  const fetchSubtitles = useCallback(async () => {
    if (!subtitlesFile) {
      console.error('Subtitles file path is invalid');
      cancelRender(new Error('Subtitles file path is invalid'));
      return;
    }

    try {
      await loadFont();
      const res = await fetch(subtitlesFile);
      if (!res.ok) {
        throw new Error(`Failed to fetch subtitles file: ${res.statusText}`);
      }
      const data = await res.json();
      setSubtitles(data.transcription);
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
  }, [handle, subtitlesFile]);

  const fetchImages = useCallback(async () => {
    if (!imagesFile) {
      console.error('Images file path is invalid');
      return;
    }

    try {
      const res = await fetch(imagesFile);
      if (!res.ok) {
        throw new Error(`Failed to fetch images file: ${res.statusText}`);
      }
      let data = await res.json();

      // Check if data is nested array and flatten it
      if (Array.isArray(data) && Array.isArray(data[0])) {
        data = data.flat();
      }

      setImages(data);
    } catch (e) {
      console.error('Failed to fetch images:', e);
    }
  }, [imagesFile]);

  useEffect(() => {
    fetchSubtitles();
    fetchImages();
  }, [fetchSubtitles, fetchImages]);

  return (
    <AbsoluteFill style={{ backgroundColor: 'white' }}>
      <AbsoluteFill>
        <OffthreadVideo
          style={{
            objectFit: 'cover',
          }}
          src={src}
        />
      </AbsoluteFill>
      {subtitles.map((subtitle, index) => {
        const nextSubtitle = subtitles[index + 1] ?? null;
        const subtitleStartFrame = subtitle.startInSeconds * fps;
        const subtitleEndFrame = Math.min(
          nextSubtitle ? nextSubtitle.startInSeconds * fps : Infinity,
          subtitleStartFrame + fps,
        );
        const durationInFrames = subtitleEndFrame - subtitleStartFrame;
        if (durationInFrames <= 0) {
          return null;
        }

        return (
          <Sequence
            from={subtitleStartFrame}
            durationInFrames={durationInFrames}
            key={index}
          >
            <Subtitle key={index} text={subtitle.text} />
          </Sequence>
        );
      })}
      {images.map((image, index) => {
        if (isNaN(image.startInSeconds)) {
          console.error(`Image ${index} has invalid startInSeconds: ${image.startInSeconds}`);
          return null;
        }

        const nextImage = images[index + 1]?? null;
        const imageStartFrame = image.startInSeconds * fps;
        const imageEndFrame = nextImage
        ? nextImage.startInSeconds * fps
          : imageStartFrame + fps * 5; // Display each image for 5 seconds if there is no next image
        const durationInFrames = imageEndFrame - imageStartFrame;

        if (durationInFrames <= 0) {
          return null;
        }

        return (
          <Sequence
            from={imageStartFrame}
            durationInFrames={durationInFrames}
            key={`image-${index}`}
          >
            <AbsoluteFill
              style={{
                alignItems: 'center',
                justifyContent: 'flex-start',
                paddingTop: '10%',
                opacity: 0, // initial opacity is 0
                transition: 'opacity 0.5s', // add a transition effect
              }}
            >
              <img
                src={staticFile(`output/${image.image}`)}
                style={{
                  width: '80%',
                  height: 'auto',
                }}
                alt=""
                onLoad={(e) => {
                  // when the image is loaded, set opacity to 1
                  e.target.parentNode.style.opacity = 1;
                }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
