import React from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';

export const renderTextWithLinks = (text: string, color: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+|rehearsalhub:\/\/[^\s]+|exp:\/\/[^\s]+)/gi;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <Text key={i} style={{ color: '#60a5fa', textDecorationLine: 'underline' }} onPress={() => Linking.openURL(part)}>
          {part}
        </Text>
      );
    }
    return <Text key={i} style={{ color }}>{part}</Text>;
  });
};

export const CustomLinkPreview = React.memo(({ url, isMe, accentColor }: {
  url: string;
  isMe: boolean;
  accentColor: string;
  bubbleColor?: string;
}) => {
  const [meta, setMeta] = React.useState<{ title?: string; description?: string; image?: string; siteName?: string } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const fetchMeta = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
        });
        clearTimeout(timeout);
        const html = await res.text();
        const getTag = (prop: string) => {
          const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
                  || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
          return m?.[1]?.trim() || '';
        };
        const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const hostname = (() => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url.split('/')[0]; } })();
        if (!cancelled) {
          const title = getTag('og:title') || getTag('twitter:title') || titleM?.[1]?.trim() || '';
          const description = getTag('og:description') || getTag('twitter:description') || getTag('description') || '';
          const image = getTag('og:image') || getTag('twitter:image') || '';
          const siteName = getTag('og:site_name') || hostname;
          setMeta(title ? { title, description, image, siteName } : null);
        }
      } catch {
        if (!cancelled) setMeta(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchMeta();
    return () => { cancelled = true; };
  }, [url]);

  if (loading) {
    return (
      <View style={{
        marginTop: 6,
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.15)',
        padding: 10,
        minHeight: 44,
        justifyContent: 'center',
      }}>
        <ActivityIndicator size="small" color={accentColor} />
      </View>
    );
  }

  if (!meta?.title && !meta?.description) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => Linking.openURL(url).catch(() => {})}
      style={{
        marginTop: 6,
        borderRadius: 10,
        overflow: 'hidden',
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
        backgroundColor: isMe ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.1)',
      }}
    >
      {!!meta?.image && (
        <Image
          source={{ uri: meta.image }}
          style={{ width: '100%', height: 160 }}
          contentFit="cover"
        />
      )}
      <View style={{ padding: 10, gap: 3 }}>
        {!!meta?.siteName && (
          <Text style={{ fontSize: 11, color: accentColor, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }} numberOfLines={1}>
            {meta.siteName}
          </Text>
        )}
        {!!meta?.title && (
          <Text style={{ fontSize: 13, color: '#ffffff', fontWeight: '700', lineHeight: 18 }} numberOfLines={2}>
            {meta.title}
          </Text>
        )}
        {!!meta?.description && (
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 16 }} numberOfLines={2}>
            {meta.description}
          </Text>
        )}
        <Text style={{ fontSize: 11, color: accentColor, marginTop: 2 }} numberOfLines={1}>
          {url.length > 50 ? url.slice(0, 50) + '…' : url}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default CustomLinkPreview;
