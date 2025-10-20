import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MessageAI MVP</Text>
      <Text style={styles.subtitle}>WhatsApp-style Messaging App</Text>
      <Text style={styles.status}>✅ Setup Complete!</Text>
      <Text style={styles.info}>
        Firebase Project: messageai-mlx93
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  status: {
    fontSize: 24,
    color: '#34C759',
    marginBottom: 20,
  },
  info: {
    fontSize: 14,
    color: '#999',
    marginTop: 20,
  },
});

