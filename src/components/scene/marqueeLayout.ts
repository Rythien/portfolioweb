/**
 * Where the hero marquee headline sits, in screen terms, without three.js:
 * Marquee.tsx draws it from these values, and crystalState (page chrome,
 * kept three-free) reads them to keep the phone crystal above the type.
 */

/** The marquee's own (FBO) camera: vertical fov 50, at z 6. */
export const FBO_HALF_FOV_RAD = (50 / 2) * (Math.PI / 180);
export const FBO_CAM_Z = 6;
/** The headline's plane. */
export const TEXT_Z = -3;
export const CAM_TO_TEXT = FBO_CAM_Z - TEXT_Z;
/** World height visible at the headline's plane. */
export const VIS_HEIGHT = 2 * CAM_TO_TEXT * Math.tan(FBO_HALF_FOV_RAD);

/** Phones: the headline's centre, world units below the midline. */
export const MOBILE_TEXT_Y = -0.66;
/** Headline font size as a share of the visible height. */
export const MOBILE_FONT_SHARE = 0.14;
export const DESKTOP_FONT_SHARE = 0.22;
/** Half the headline's line box, in font sizes (anchorY middle). */
export const LINE_HALF = 0.6;

/**
 * Phones: the top of the headline's line box, in CSS px from the top of a
 * viewport pxH tall (the FBO fills the viewport, so it scales with height
 * alone).
 */
export function mobileMarqueeTopPx(pxH: number): number {
  const topWorld = MOBILE_TEXT_Y + MOBILE_FONT_SHARE * VIS_HEIGHT * LINE_HALF;
  return pxH / 2 - (topWorld / (VIS_HEIGHT / 2)) * (pxH / 2);
}
