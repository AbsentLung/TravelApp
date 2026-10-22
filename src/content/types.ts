export type ContinentId =
  | 'africa'
  | 'asia'
  | 'europe'
  | 'north-america'
  | 'south-america'
  | 'oceania';

export interface Continent {
  id: ContinentId;
  name: string;
  blurb: string;
  /** Label anchor point on the world map canvas (see content/worldGeo.ts). */
  labelX: number;
  labelY: number;
  color: string;
}

export interface Destination {
  /** Slug, unique within its country. */
  id: string;
  name: string;
  /** One-line summary shown on cards. */
  summary: string;
  /** When you visited, free text (e.g. "May 2024"). */
  visited?: string;
  tags?: string[];
  /** 1-5, optional personal rating. */
  rating?: number;
  /** Full notes, written as markdown. This is what your pasted notes become. */
  body: string;
  /** Optional photo URIs (remote URLs or local requires aren't supported here — use URLs). */
  photos?: string[];
}

export interface CountryContent {
  /** Slug, unique across the whole site. */
  id: string;
  continentId: ContinentId;
  name: string;
  /** Short summary shown on the continent screen's country list. */
  summary: string;
  /**
   * Optional country-wide overview, written as markdown — rendered above
   * the destination list. Good home for TL;DR-style notes that don't
   * belong to any single destination (e.g. "best for nightlife: X, Y, Z").
   */
  intro?: string;
  destinations: Destination[];
}
