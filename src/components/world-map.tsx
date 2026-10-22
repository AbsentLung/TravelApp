import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Path, Text as SvgText, G } from 'react-native-svg';

import { continents, getContinent } from '@/content/continents';
import { worldCountries, WORLD_MAP_VIEW } from '@/content/worldGeo';

const { width: VIEW_W, height: VIEW_H } = WORLD_MAP_VIEW;

// Hackathon demo: adapted from ~/travel-blog/components/WorldMap.tsx (same
// SVG country-outline dataset) but swaps "has a blog post" for "has a
// TravelApp destination built" - right now that's just Bali.
const NAVIGABLE: Record<string, string> = {
  indonesia: '/indonesia/bali',
};

const colors = { ink: '#1C2430', bg: '#FDFBF7', ocean: '#EAF2F5' };

// react-native-svg's web renderer doesn't support RN's responder props
// (onPressIn/onPressOut) - real hover only makes sense on web anyway, so we
// use plain DOM mouse events there and RN's press events on native.
function activationHandlers(onStart: () => void, onEnd: () => void) {
  if (Platform.OS === 'web') {
    return { onMouseEnter: onStart, onMouseLeave: onEnd, style: { cursor: 'pointer' } };
  }
  return { onPressIn: onStart, onPressOut: onEnd };
}

interface WorldMapProps {
  onSelectCountry: (countryId: string, route: string) => void;
}

export function WorldMap({ onSelectCountry }: WorldMapProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <View style={styles.wrap}>
      <Svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={styles.svg}>
        {worldCountries.map((country) => {
          const continent = getContinent(country.continentId);
          if (!continent) return null;
          const route = NAVIGABLE[country.id];
          const isActive = activeId === country.id;

          return (
            <Path
              key={country.id}
              d={country.d}
              fillRule="evenodd"
              fill={continent.color}
              opacity={route ? (isActive ? 1 : 0.85) : isActive ? 0.5 : 0.32}
              stroke={isActive && route ? colors.ink : colors.bg}
              strokeWidth={isActive && route ? 1.4 : 0.6}
              {...activationHandlers(
                () => setActiveId(country.id),
                () => setActiveId(null)
              )}
              onPress={() => route && onSelectCountry(country.id, route)}
            />
          );
        })}

        <G>
          {continents.map((continent) => (
            <SvgText
              key={continent.id}
              x={continent.labelX}
              y={continent.labelY}
              fontSize={13}
              fontWeight="700"
              fill={colors.ink}
              textAnchor="middle"
              opacity={0.85}
            >
              {continent.name}
            </SvgText>
          ))}
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    backgroundColor: colors.ocean,
    borderRadius: 20,
    overflow: 'hidden',
  },
  svg: {
    width: '100%',
    aspectRatio: VIEW_W / VIEW_H,
  },
});
