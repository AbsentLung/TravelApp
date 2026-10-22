import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

// Hackathon demo: Leaflet is DOM-only, so this only renders on web - the
// fastest path to something visible with no native build step. Plan.md has
// the real map-library decision (likely MapLibre) for the native app later.
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet caches its container size at mount and only re-measures on window
// resize - it never notices our flex layout shrinking it for the side panel,
// so it must be told to re-measure explicitly whenever the panel toggles.
function MapResize({ panelOpen }: { panelOpen: boolean }) {
  const map = useMap();
  useEffect(() => {
    const id = requestAnimationFrame(() => map.invalidateSize());
    return () => cancelAnimationFrame(id);
  }, [panelOpen, map]);
  return null;
}

interface Gym {
  id: number;
  name: string;
  lat: number;
  lng: number;
  rating: string;
  description: string;
}

interface Review {
  id: number;
  author: string;
  rating: number;
  body: string;
  created_at: string;
}

const BALI_CENTER: [number, number] = [-8.52, 115.1];
const RATINGS = [1, 2, 3, 4, 5];

function ReviewsSection({ gym }: { gym: Gym }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [author, setAuthor] = useState('');
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = () => {
    fetch(`http://localhost:3001/api/gyms/${gym.id}/reviews`)
      .then((r) => r.json())
      .then(setReviews)
      .catch((e) => console.error('Failed to load reviews', e));
  };

  useEffect(loadReviews, [gym.id]);

  const submit = async () => {
    if (!author.trim() || !body.trim() || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`http://localhost:3001/api/gyms/${gym.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, rating, body }),
      });
      setAuthor('');
      setBody('');
      setRating(5);
      loadReviews();
    } catch (e) {
      console.error('Failed to submit review', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.panelRow}>
      <Text style={styles.panelLabel}>Reviews ({reviews.length})</Text>

      <View style={styles.reviewForm}>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          value={author}
          onChangeText={setAuthor}
        />
        <View style={styles.ratingPicker}>
          {RATINGS.map((n) => (
            <Pressable key={n} style={styles.starHit} onPress={() => setRating(n)}>
              <Text style={[styles.star, n <= rating && styles.starFilled]}>★</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="How was it?"
          value={body}
          onChangeText={setBody}
          multiline
        />
        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={submit}
        >
          <Text style={styles.submitButtonText}>{submitting ? 'Posting…' : 'Post review'}</Text>
        </Pressable>
      </View>

      {reviews.length === 0 ? (
        <Text style={styles.panelValue}>No reviews yet — be the first.</Text>
      ) : (
        reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewCardHeader}>
              <Text style={styles.reviewAuthor}>{review.author}</Text>
              <Text style={styles.reviewStars}>{'★'.repeat(review.rating)}</Text>
            </View>
            <Text style={styles.panelValue}>{review.body}</Text>
          </View>
        ))
      )}
    </View>
  );
}

export default function BaliGymMap() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/gyms')
      .then((r) => r.json())
      .then(setGyms)
      .catch((e) => console.error('Failed to load gyms', e));
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.center}>
        <Text>Open this in a web browser for the demo (npm run web).</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.mapArea}>
        <MapContainer center={BALI_CENTER} zoom={11} style={styles.map}>
          <MapResize panelOpen={!!selectedGym} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {gyms.map((gym) => (
            <CircleMarker
              key={gym.id}
              center={[gym.lat, gym.lng]}
              radius={8}
              pathOptions={{
                color: '#146C5F',
                fillColor: gym.id === selectedGym?.id ? '#146C5F' : '#3FA393',
                fillOpacity: 0.9,
              }}
              eventHandlers={{ click: () => setSelectedGym(gym) }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                {gym.name} {gym.rating ? `· ⭐ ${gym.rating}` : ''}
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Gym Finder — Bali ({gyms.length} gyms)</Text>
        </View>
      </View>
      {selectedGym && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>{selectedGym.name}</Text>
            <Pressable style={styles.panelCloseHit} onPress={() => setSelectedGym(null)}>
              <Text style={styles.panelClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.panelScroll} contentContainerStyle={styles.panelScrollContent}>
            <View style={styles.panelRow}>
              <Text style={styles.panelLabel}>Rating</Text>
              <Text style={styles.panelValue}>
                {selectedGym.rating ? `⭐ ${selectedGym.rating}` : 'No rating yet'}
              </Text>
            </View>
            <View style={styles.panelRow}>
              <Text style={styles.panelLabel}>Description</Text>
              <Text style={styles.panelValue}>{selectedGym.description || '—'}</Text>
            </View>
            <View style={styles.panelRow}>
              <Text style={styles.panelLabel}>Coordinates</Text>
              <Text style={styles.panelValue}>
                {selectedGym.lat.toFixed(5)}, {selectedGym.lng.toFixed(5)}
              </Text>
            </View>
            <ReviewsSection gym={selectedGym} />
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // @ts-expect-error - web-only CSS sizing, fine for the demo
  root: { flex: 1, flexDirection: 'row', height: '100vh' },
  mapArea: { flex: 1, position: 'relative' },
  map: { height: '100%', width: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  badge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)' as unknown as undefined,
    zIndex: 1000,
  },
  badgeText: { fontWeight: '600', color: '#1C2430' },
  panel: {
    width: 320,
    backgroundColor: 'white',
    boxShadow: '-2px 0 8px rgba(0,0,0,0.15)' as unknown as undefined,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E9EC',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  panelTitle: { fontSize: 18, fontWeight: '700', color: '#1C2430', flex: 1, paddingRight: 8 },
  // @ts-expect-error - web-only cursor hint, fine for the demo
  panelCloseHit: { cursor: 'pointer', padding: 8 },
  panelClose: { fontSize: 16, color: '#6B7680' },
  panelScroll: { flex: 1 },
  panelScrollContent: { padding: 20, gap: 20 },
  panelRow: { gap: 8 },
  panelLabel: { fontSize: 11, fontWeight: '600', color: '#8A94A0', textTransform: 'uppercase', letterSpacing: 0.5 },
  panelValue: { fontSize: 14, color: '#1C2430', lineHeight: 20 },
  reviewForm: {
    gap: 8,
    backgroundColor: '#F7F8F9',
    borderRadius: 10,
    padding: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDE2E6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: 'white',
  },
  textarea: { minHeight: 60, textAlignVertical: 'top' },
  ratingPicker: { flexDirection: 'row', gap: 2 },
  // @ts-expect-error - web-only cursor hint, fine for the demo
  starHit: { cursor: 'pointer', padding: 2 },
  star: { fontSize: 18, color: '#D7DBDF' },
  starFilled: { color: '#E0A500' },
  submitButton: {
    backgroundColor: '#146C5F',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: 'white', fontWeight: '600', fontSize: 13 },
  reviewCard: {
    gap: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  reviewCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewAuthor: { fontSize: 13, fontWeight: '700', color: '#1C2430' },
  reviewStars: { fontSize: 12, color: '#E0A500' },
});
