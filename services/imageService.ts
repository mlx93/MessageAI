/**
 * Image Service
 * 
 * Handles image picking, compression, and upload to Cloud Storage
 * Compresses images larger than 5MB before upload
 */

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Pick an image from the device's media library
 * 
 * @returns Image URI or null if cancelled/failed
 */
export const pickImage = async (): Promise<string | null> => {
  try {
    // Check current permission status first
    const permissionResult = await ImagePicker.getMediaLibraryPermissionsAsync();
    
    // If we don't have permission, request it
    if (permissionResult.status !== 'granted') {
      console.log('Requesting media library permissions...');
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        console.log(`Permission to access photos denied (status: ${status}, canAskAgain: ${canAskAgain})`);
        
        if (!canAskAgain) {
          Alert.alert(
            'Photo Access Required',
            'Please enable photo access for aiMessage in your device Settings app to share images.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Photo Access Required',
            'aiMessage needs permission to access your photos to share images in conversations.',
            [{ text: 'OK' }]
          );
        }
        return null;
      }
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
      allowsEditing: false,
    });

    if (result.canceled) {
      return null;
    }

    return result.assets[0].uri;
  } catch (error) {
    console.error('Failed to pick image:', error);
    return null;
  }
};

/**
 * Compress an image to reduce file size
 * 
 * Resizes to max width of 1920px and compresses quality to 0.7
 * 
 * @param uri - URI of the image to compress
 * @returns URI of the compressed image
 */
export const compressImage = async (uri: string): Promise<string> => {
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1920 } }], // Max width 1920px, maintains aspect ratio
      {
        compress: 0.7, // 70% quality
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    
    return compressed.uri;
  } catch (error) {
    console.error('Failed to compress image:', error);
    throw error;
  }
};

/**
 * Progressive compression based on file size
 * Uses different compression tiers for different file sizes
 * 
 * @param uri - URI of the image to compress
 * @param size - Size of the image in bytes
 * @returns URI of the compressed image
 */
export const compressImageProgressive = async (uri: string, size: number): Promise<string> => {
  let width = 1920;
  let quality = 0.7;
  
  console.log(`📸 Compressing image: ${(size / 1024 / 1024).toFixed(2)}MB`);
  
  // Tier 1: >10MB (aggressive)
  if (size > 10 * 1024 * 1024) {
    width = 1280;
    quality = 0.6;
    console.log('📸 Using Tier 1 compression (10MB+): 1280px, 60% quality');
  }
  
  // Tier 2: >20MB (very aggressive)
  if (size > 20 * 1024 * 1024) {
    width = 1024;
    quality = 0.5;
    console.log('📸 Using Tier 2 compression (20MB+): 1024px, 50% quality');
  }
  
  // Tier 3: >50MB (extreme)
  if (size > 50 * 1024 * 1024) {
    width = 800;
    quality = 0.4;
    console.log('📸 Using Tier 3 compression (50MB+): 800px, 40% quality');
  }
  
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );
  
  const newSize = await getFileSize(compressed.uri);
  console.log(`✅ Compressed: ${(size / 1024 / 1024).toFixed(2)}MB → ${(newSize / 1024 / 1024).toFixed(2)}MB`);
  
  return compressed.uri;
};

/**
 * Get file size from URI
 * 
 * @param uri - File URI
 * @returns File size in bytes
 */
const getFileSize = async (uri: string): Promise<number> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch (error) {
    console.error('Failed to get file size:', error);
    return 0;
  }
};

/**
 * Get MIME type from URI
 * 
 * @param uri - File URI
 * @returns MIME type string
 */
export const getMimeType = async (uri: string): Promise<string> => {
  try {
    // Extract from URI extension
    const extension = uri.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'heic':
        return 'image/heic';
      default:
        return 'image/jpeg'; // Default
    }
  } catch (error) {
    console.error('Failed to detect MIME type:', error);
    return 'image/jpeg';
  }
};

/**
 * Upload an image to Cloud Storage
 * 
 * Automatically compresses images larger than 5MB using progressive compression
 * 
 * @param uri - URI of the image to upload
 * @param conversationId - ID of the conversation (for organizing storage)
 * @returns Download URL of the uploaded image
 */
export const uploadImage = async (uri: string, conversationId: string): Promise<string> => {
  try {
    // Check file size
    const size = await getFileSize(uri);
    let finalUri = uri;
    
    // Always compress images > 5MB (now with progressive tiers)
    if (size > 5 * 1024 * 1024) {
      console.log(`📸 Image is ${(size / 1024 / 1024).toFixed(2)}MB, compressing...`);
      finalUri = await compressImageProgressive(uri, size);
    }
    
    // Fetch the image as a blob
    const response = await fetch(finalUri);
    const blob = await response.blob();
    
    // Create a reference to the storage location
    const timestamp = Date.now();
    const filename = `${timestamp}.jpg`;
    const storageRef = ref(storage, `images/${conversationId}/${filename}`);
    
    // Upload the blob
    console.log('Uploading image...');
    await uploadBytes(storageRef, blob);
    
    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Image uploaded successfully:', downloadURL);
    
    return downloadURL;
  } catch (error) {
    console.error('Failed to upload image:', error);
    throw error;
  }
};

/**
 * Upload an image with timeout and retry logic
 * 
 * @param uri - URI of the image to upload
 * @param conversationId - ID of the conversation
 * @param timeoutMs - Timeout in milliseconds (default 15000)
 * @param retryCount - Current retry attempt (default 0)
 * @returns Download URL of the uploaded image
 */
export const uploadImageWithTimeout = async (
  uri: string,
  conversationId: string,
  timeoutMs = 15000,
  retryCount = 0
): Promise<string> => {
  const uploadPromise = uploadImage(uri, conversationId);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Upload timeout')), timeoutMs)
  );
  
  try {
    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (error: any) {
    const isTimeout = error.message === 'Upload timeout';
    
    // Retry once on timeout
    if (isTimeout && retryCount < 1) {
      console.log('📸 Upload timeout, retrying...');
      return await uploadImageWithTimeout(uri, conversationId, timeoutMs, retryCount + 1);
    }
    
    // Retry once on network error
    if (!isTimeout && retryCount < 1) {
      console.log('📸 Upload failed, retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay
      return await uploadImageWithTimeout(uri, conversationId, timeoutMs, retryCount + 1);
    }
    
    throw error;
  }
};

/**
 * Pick and upload an image in one operation
 * 
 * @param conversationId - ID of the conversation
 * @returns Download URL of the uploaded image, or null if cancelled/failed
 */
export const pickAndUploadImage = async (conversationId: string): Promise<string | null> => {
  try {
    // Pick image
    const uri = await pickImage();
    if (!uri) {
      return null;
    }
    
    // Upload image
    const downloadURL = await uploadImage(uri, conversationId);
    return downloadURL;
  } catch (error) {
    console.error('Failed to pick and upload image:', error);
    throw error;
  }
};

/**
 * Pick and upload profile picture
 * Returns download URL or null
 */
export const uploadProfilePicture = async (userId: string): Promise<string | null> => {
  try {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photos in Settings to upload a profile picture.',
        [{ text: 'OK' }]
      );
      return null;
    }
    
    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square crop
      quality: 0.8
    });
    
    if (result.canceled || !result.assets[0]) {
      return null;
    }
    
    const uri = result.assets[0].uri;
    
    // Compress image (profile pics should be small)
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 400 } }], // Max 400px
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    
    // Upload to Storage
    const response = await fetch(compressed.uri);
    const blob = await response.blob();
    
    const storageRef = ref(storage, `profile-pictures/${userId}/${Date.now()}.jpg`);
    await uploadBytes(storageRef, blob);
    
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Failed to upload profile picture:', error);
    throw error;
  }
};

