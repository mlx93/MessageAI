import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaView} from 'react-native-safe-area-context';

export default function AvaAssistant() {
  const [searchQuery, setSearchQuery] = useState('');

  const features = [
    {
      icon: '🔍',
      title: 'Smart Search',
      description: 'Search across all conversations semantically',
      route: '/ava/search',
      color: '#007AFF',
    },
    {
      icon: '✅',
      title: 'Action Items',
      description: 'View all pending tasks and assignments',
      route: '/ava/action-items',
      color: '#34C759',
    },
    {
      icon: '📌',
      title: 'Decisions',
      description: 'Track team decisions and agreements',
      route: '/ava/decisions',
      color: '#FF9500',
    },
    {
      icon: '💬',
      title: 'Chat with Ava',
      description: 'Natural language AI assistant',
      route: '/ava/chat',
      color: '#AF52DE',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey there! 👋</Text>
          <Text style={styles.title}>I'm Ava</Text>
          <Text style={styles.subtitle}>Your AI assistant for MessageAI</Text>
        </View>
      </View>

      {/* Quick Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Ask Ava anything..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => {
              if (searchQuery.trim()) {
                router.push({
                  pathname: '/ava/chat',
                  params: {initialQuery: searchQuery},
                });
              }
            }}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Features Grid */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>What can I help you with?</Text>

        <View style={styles.featuresGrid}>
          {features.map((feature, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.featureCard, {borderLeftColor: feature.color}]}
              onPress={() => router.push(feature.route as any)}>
              <View style={styles.featureHeader}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>
                {feature.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View style={styles.recentCard}>
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={styles.recentText}>
              Your recent AI interactions will appear here
            </Text>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsSection}>
          <Text style={styles.sectionTitle}>💡 Tips</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipText}>
              • Ask me to summarize any conversation{'\n'}
              • I automatically detect priority messages{'\n'}
              • Search using natural language{'\n'}
              • I'll proactively suggest meeting times
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  greeting: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  content: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  featuresGrid: {
    paddingHorizontal: 20,
    gap: 16,
  },
  featureCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 32,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  recentSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    gap: 12,
  },
  recentText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  tipsSection: {
    marginBottom: 32,
  },
  tipCard: {
    backgroundColor: '#F0F8FF',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#007AFF20',
  },
  tipText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
});

