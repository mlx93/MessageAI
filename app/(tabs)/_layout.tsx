/**
 * Tabs Layout
 * 
 * Main navigation for the app with bottom tabs
 * For now, just showing the Chats tab
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: true,
        headerBackTitleVisible: false,
        headerBackTitle: '',
        headerTintColor: '#007AFF',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Messages',
          headerLargeTitle: true,
          headerStyle: {
            height: 120, // Increase header height for more space
          },
          headerTitleAlign: 'center', // Center title on Android
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '600',
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ava"
        options={{
          title: 'Ava',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          headerLargeTitle: true,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

