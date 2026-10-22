import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { WorldMap } from '@/components/world-map';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Where to?</Text>
        <Text style={styles.subtitle}>Pick a lit-up country to see what's built so far.</Text>
      </View>
      <View style={styles.mapWrap}>
        {/* @ts-expect-error - router path isn't in the typed-routes map yet, fine for the demo */}
        <WorldMap onSelectCountry={(_countryId, route) => router.push(route)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDFBF7', padding: 24, gap: 16 },
  header: { gap: 4 },
  title: { fontSize: 26, fontWeight: '700', color: '#1C2430' },
  subtitle: { fontSize: 14, color: '#7A6F63' },
  mapWrap: { flex: 1, justifyContent: 'center' },
});
