export type LoadingSeason = 'winter' | 'spring' | 'summer' | 'autumn';
export type LoadingTimeOfDay = 'night' | 'morning' | 'day' | 'evening';

export interface LoadingBackground {
  season: LoadingSeason;
  timeOfDay: LoadingTimeOfDay;
  assetPath: string;
}

const BACKGROUND_ROOT = '/UI/01_WelcomeScreen/BackgroundPaintings';
const LOADING_LOGO_ROOT = '/UI/01_WelcomeScreen';

export function resolveLoadingLogoPath(now = new Date()): string {
  const season = resolveSeason(now);

  if (season === 'winter' || season === 'spring') {
    return `${LOADING_LOGO_ROOT}/logo_winter.webp`;
  }

  return `${LOADING_LOGO_ROOT}/logo_summer.webp`;
}

export function resolveSeason(date: Date): LoadingSeason {
  const month = date.getMonth();

  if (month === 11 || month <= 1) {
    return 'winter';
  }
  if (month <= 4) {
    return 'spring';
  }
  if (month <= 7) {
    return 'summer';
  }
  return 'autumn';
}

export function resolveTimeOfDay(date: Date): LoadingTimeOfDay {
  const hour = date.getHours();

  if (hour < 5) {
    return 'night';
  }
  if (hour < 11) {
    return 'morning';
  }
  if (hour < 18) {
    return 'day';
  }
  if (hour < 22) {
    return 'evening';
  }
  return 'night';
}

export function resolveLoadingBackground(now = new Date()): LoadingBackground {
  const season = resolveSeason(now);
  const timeOfDay = resolveTimeOfDay(now);

  return {
    season,
    timeOfDay,
    assetPath: `${BACKGROUND_ROOT}/${season}_${timeOfDay}.webp`,
  };
}
